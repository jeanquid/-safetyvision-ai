import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import './../../tests/mocks/db';
import './../../tests/mocks/gemini';
import { mockDb } from '../mocks/db';
import { analyzeImageWithGemini, analyzeTextDescription } from '../../api/_ai-engine.js';
import { savePhoto, getPhoto } from '../../api/_storage.js';
import { generateInspectionPDF } from '../../api/_pdf.js';
import { v4 as uuidv4 } from 'uuid';

let app: any;
let authToken: string;

beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    const { createApiApp } = await import('../../api/_app.js');
    app = await createApiApp();

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'testpass123' });
    authToken = loginRes.body.token;
});

beforeEach(() => {
    mockDb._clear();
});

const auth = () => ({ Authorization: `Bearer ${authToken}` });

describe('Bounding Boxes (Visual Annotation)', () => {
    describe('AI Parser & Coordinates Clamping', () => {
        it('debe parsear bounding boxes en el pipeline de análisis de imagen', async () => {
            const result = await analyzeImageWithGemini('c29tZSBkYXRh', 'image/jpeg');
            expect(result.risks.length).toBeGreaterThan(0);
            
            const first = result.risks[0];
            expect(first.bbox).toBeDefined();
            expect(first.bbox).not.toBeNull();
            expect(first.bbox!.x).toBe(0.1);
            expect(first.bbox!.y).toBe(0.2);
            expect(first.bbox!.w).toBe(0.3);
            expect(first.bbox!.h).toBe(0.4);
            expect(first.bbox!.label).toBe('Operario sin casco');
        });

        it('debe forzar coordenadas entre 0 y 1 (clamp)', async () => {
            // Mock temporal para simular valores fuera de rango
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI('key');
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const originalImpl = model.generateContent;
            model.generateContent = vi.fn().mockResolvedValue({
                response: {
                    text: () => JSON.stringify({
                        risks: [{
                            category: 'epp',
                            description: 'Test clamp',
                            level: 'alto',
                            probability: 4,
                            consequence: 4,
                            confidence: 90,
                            bbox: {
                                x: -0.5,
                                y: 1.8,
                                w: 0.4,
                                h: 0.6,
                                label: 'Clamp'
                            }
                        }]
                    })
                }
            });

            try {
                const result = await analyzeImageWithGemini('c29tZSBkYXRh', 'image/jpeg');
                const risk = result.risks[0];
                expect(risk.bbox).toBeDefined();
                expect(risk.bbox!.x).toBe(0); // -0.5 clamped to 0
                expect(risk.bbox!.y).toBe(1); // 1.8 clamped to 1
                expect(risk.bbox!.w).toBe(0.4);
                expect(risk.bbox!.h).toBe(0.6);
            } finally {
                model.generateContent = originalImpl;
            }
        });

        it('debe dejar bbox en null para análisis de texto', async () => {
            const result = await analyzeTextDescription('Operario trabajando sin casco');
            expect(result.risks.length).toBeGreaterThan(0);
            result.risks.forEach(r => {
                expect(r.bbox).toBeNull();
            });
        });
    });

    describe('Almacenamiento de Dimensiones de Foto', () => {
        it('debe guardar y retornar las dimensiones asignadas en savePhoto y getPhoto', async () => {
            const inspectionId = uuidv4();
            const { photoId } = await savePhoto(inspectionId, 'c29tZSBkYXRh', 'image/jpeg', 800, 600);
            
            const photo = await getPhoto(photoId);
            expect(photo).not.toBeNull();
            expect(photo!.mimeType).toBe('image/jpeg');
            expect(photo!.data).toBe('c29tZSBkYXRh');
            expect(photo!.width).toBe(800);
            expect(photo!.height).toBe(600);
        });

        it('debe extraer dimensiones automáticamente usando sharp si no se proveen', async () => {
            // Imagen JPEG de 1x1 píxeles en base64
            const onePixelJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
            const inspectionId = uuidv4();
            const { photoId } = await savePhoto(inspectionId, onePixelJpeg, 'image/jpeg');
            
            const photo = await getPhoto(photoId);
            expect(photo).not.toBeNull();
            expect(photo!.width).toBe(1);
            expect(photo!.height).toBe(1);
        });
    });

    describe('Generación de PDF con Anotaciones', () => {
        it('debe compilar el PDF exitosamente con riesgos que tengan bbox válido', async () => {
            const inspection = {
                inspectionId: uuidv4(),
                tenantId: 'ensi',
                userId: 'test-user',
                companyId: 'co-001',
                status: 'closed' as const,
                plant: 'Planta A',
                sector: 'Sector B',
                operator: 'Inspector 1',
                risks: [
                    {
                        id: 'r-1',
                        category: 'epp' as const,
                        description: 'Sin casco',
                        level: 'alto' as const,
                        status: 'pendiente' as const,
                        confidence: 90,
                        history: [],
                        bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4, label: 'Cabeza' }
                    }
                ],
                task: { status: 'pendiente' as const, action: 'Acción', responsible: 'Resp', deadline: '48 hs' },
                auditTrail: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const pdfBuffer = await generateInspectionPDF(inspection);
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
        });

        it('debe generar el PDF sin errores cuando bbox sea null', async () => {
            const inspection = {
                inspectionId: uuidv4(),
                tenantId: 'ensi',
                userId: 'test-user',
                companyId: 'co-001',
                status: 'closed' as const,
                plant: 'Planta A',
                sector: 'Sector B',
                operator: 'Inspector 1',
                risks: [
                    {
                        id: 'r-1',
                        category: 'epp' as const,
                        description: 'Sin casco',
                        level: 'alto' as const,
                        status: 'pendiente' as const,
                        confidence: 90,
                        history: [],
                        bbox: null
                    }
                ],
                task: { status: 'pendiente' as const, action: 'Acción', responsible: 'Resp', deadline: '48 hs' },
                auditTrail: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const pdfBuffer = await generateInspectionPDF(inspection);
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
        });
    });
});
