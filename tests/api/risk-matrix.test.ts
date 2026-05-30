import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import './../../tests/mocks/db';
import './../../tests/mocks/gemini';
import { mockDb } from '../mocks/db';
import { deriveLevelFromScore } from '../../api/_types.js';
import { analyzeTextDescription } from '../../api/_ai-engine.js';
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

describe('Risk Matrix (Assisted 5x5)', () => {
    describe('deriveLevelFromScore Math', () => {
        it('debe mapear correctamente los scores de 1 a 25 según los cortes', () => {
            // Bajo (1 a 5)
            expect(deriveLevelFromScore(1)).toBe('bajo');
            expect(deriveLevelFromScore(5)).toBe('bajo');
            
            // Medio (6 a 12)
            expect(deriveLevelFromScore(6)).toBe('medio');
            expect(deriveLevelFromScore(12)).toBe('medio');
            
            // Alto (13 a 25)
            expect(deriveLevelFromScore(13)).toBe('alto');
            expect(deriveLevelFromScore(15)).toBe('alto');
            expect(deriveLevelFromScore(25)).toBe('alto');
        });
    });

    describe('AI Integration & Parsing', () => {
        it('debe parsear probability y consequence provistos por la IA y rellenar assessment', async () => {
            const { risks } = await analyzeTextDescription('Operario sin EPP');
            expect(risks.length).toBeGreaterThan(0);
            
            const first = risks[0];
            expect(first.assessment).toBeDefined();
            expect(first.assessment!.probability).toBe(4);
            expect(first.assessment!.consequence).toBe(4);
            expect(first.assessment!.score).toBe(16);
            expect(first.assessment!.level).toBe('alto');
            expect(first.assessment!.source).toBe('ai');
            expect(first.assessment!.probabilityJustification).toBeDefined();
        });
    });

    describe('Risk Assessment Updates (PATCH)', () => {
        it('debe registrar el cambio de evaluación, cambiar el source a inspector y crear un AuditEntry', async () => {
            const inspectionId = uuidv4();
            const riskId = 'r-001';
            
            const initialState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Inspector 1',
                status: 'pending_review',
                task: { status: 'pendiente', action: 'Hacer algo', responsible: 'Resp', deadline: '24 hs' },
                risks: [{
                    id: riskId,
                    category: 'epp',
                    description: 'Sin casco',
                    level: 'medio',
                    status: 'pendiente',
                    history: [],
                    assessment: {
                        probability: 3,
                        consequence: 3,
                        score: 9,
                        level: 'medio',
                        source: 'ai'
                    }
                }],
                auditTrail: []
            };

            mockDb._setInspection(inspectionId, initialState);

            const res = await request(app)
                .patch(`/api/inspections/${inspectionId}/risks/${riskId}`)
                .set(auth())
                .send({
                    probability: 5,
                    consequence: 4,
                    note: 'Ajustado según criticidad del área'
                });

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);

            const updatedRisk = res.body.inspection.risks[0];
            expect(updatedRisk.assessment.probability).toBe(5);
            expect(updatedRisk.assessment.consequence).toBe(4);
            expect(updatedRisk.assessment.score).toBe(20);
            expect(updatedRisk.assessment.level).toBe('alto');
            expect(updatedRisk.assessment.source).toBe('inspector');
            expect(updatedRisk.assessment.confirmedBy).toBe('test-user-id-001');

            // Verificar entrada de auditoría
            expect(updatedRisk.history.length).toBe(1);
            expect(updatedRisk.history[0].action).toBe('risk_edited');
            expect(updatedRisk.history[0].note).toContain('Ajustado según criticidad del área');
            expect(updatedRisk.history[0].inspectorId).toBe('test-user-id-001');
        });
    });

    describe('Retrocompatibility (Retrocompatibilidad)', () => {
        it('debe poder leer y procesar inspecciones antiguas sin el campo assessment', async () => {
            const inspectionId = uuidv4();
            const initialStateWithoutAssessment = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Inspector Old',
                status: 'pending_review',
                task: { status: 'pendiente', action: 'Hacer algo', responsible: 'Resp', deadline: '24 hs' },
                risks: [{
                    id: 'r-old-01',
                    category: 'epp',
                    description: 'Sin casco',
                    level: 'medio',
                    status: 'pendiente',
                    history: []
                }],
                auditTrail: []
            };

            mockDb._setInspection(inspectionId, initialStateWithoutAssessment);

            const res = await request(app)
                .get(`/api/inspections/${inspectionId}`)
                .set(auth());

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            const fetched = res.body.inspection;
            expect(fetched.risks[0].assessment).toBeUndefined();
            expect(fetched.risks[0].level).toBe('medio');
        });
    });
});
