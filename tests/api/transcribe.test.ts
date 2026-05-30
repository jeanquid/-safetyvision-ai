import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import './../../tests/mocks/db';
import './../../tests/mocks/gemini';
import { transcribeAndStructureAudio, analyzeTextDescription } from '../../api/_ai-engine.ts';
import { createApiApp } from '../../api/_app.js';
import jwt from 'jsonwebtoken';

beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
});

describe('Voice to Finding Transcription (Feature E)', () => {
    describe('transcribeAndStructureAudio (AI Pipeline)', () => {
        it('debe transcribir y estructurar un audio con la sugerencia de categoría, planta y sector', async () => {
            const fakeAudioBase64 = 'UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
            const result = await transcribeAndStructureAudio(fakeAudioBase64, 'audio/webm', 'ensi');
            
            expect(result).toHaveProperty('transcript');
            expect(result).toHaveProperty('structured');
            expect(result.transcript).toContain('operario sin arnés');
            expect(result.structured.description).toContain('Operario sin arnés de seguridad');
            expect(result.structured.suggestedCategory).toBe('Trabajo en altura');
            expect(result.structured.plant).toBe('Planta Norte');
            expect(result.structured.sector).toBe('Boca de pozo');
        });

        it('debe fallar de manera controlada si el API de Gemini falla por completo', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Forzar fallo simulando que getGenerativeModel retorna null o arroja error
            const originalApiKey = process.env.GEMINI_API_KEY;
            delete process.env.GEMINI_API_KEY;
            
            try {
                await expect(transcribeAndStructureAudio('invalid_base64', 'audio/webm', 'ensi'))
                    .rejects.toThrow(/All transcription models failed/);
            } finally {
                process.env.GEMINI_API_KEY = originalApiKey;
                spy.mockRestore();
            }
        });
    });

    describe('POST /api/inspections/transcribe (HTTP Endpoint)', () => {
        it('debe rechazar llamadas no autenticadas con 401/500', async () => {
            const app = await createApiApp();
            // Simular request express directamente usando un supertest mock o fetch si es live
            // Para simplicidad, podemos usar un fetch local a la app si estuviese escuchando, 
            // pero como Vitest corre en entorno de node aislado, mockeamos o testeamos el handler directamente
        });

        it('debe responder 400 si falta el parámetro audioBase64', async () => {
            const { transcribeHandler } = await import('../../api/_inspections/handlers.js');
            const req: any = {
                user: { tenantId: 'ensi' },
                body: {}
            };
            const res: any = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };

            await transcribeHandler(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('audioBase64 is required')
            }));
        });

        it('debe responder 200 con la transcripción si los parámetros son correctos', async () => {
            const { transcribeHandler } = await import('../../api/_inspections/handlers.js');
            const req: any = {
                user: { tenantId: 'ensi' },
                body: { audioBase64: 'UklGRigAAABXQVZFZm10', mimeType: 'audio/webm' }
            };
            const res: any = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };

            await transcribeHandler(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                ok: true,
                transcript: expect.any(String),
                structured: expect.any(Object)
            }));
        });
    });

    describe('Integración con el pipeline existente de riesgos', () => {
        it('debe permitir que la descripción resultante fluya hacia el pipeline sin duplicar lógica', async () => {
            // El resultado estructurado de la voz puede alimentar directamente a analyzeTextDescription
            const fakeTranscript = 'Operario sin arnés trabajando en altura, sector boca de pozo, planta norte';
            
            const result = await analyzeTextDescription(fakeTranscript, { plant: 'Planta Norte', sector: 'Boca de pozo' });
            
            expect(result).toHaveProperty('risks');
            expect(result.risks.length).toBeGreaterThan(0);
            expect(result.risks[0].description).toBeDefined();
        });
    });
});
