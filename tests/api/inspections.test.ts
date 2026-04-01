import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import './../../tests/mocks/db';
import './../../tests/mocks/gemini';
import { mockDb } from '../mocks/db';

let app: any;
let authToken: string;

beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    const { createApiApp } = await import('../../api/_app.js');
    app = await createApiApp();

    // Obtener token de prueba
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'testpass123' });
    authToken = loginRes.body.token;
});

beforeEach(() => {
    mockDb._clear();
});

const auth = () => ({ Authorization: `Bearer ${authToken}` });

describe('POST /api/inspections/analyze', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app)
            .post('/api/inspections/analyze')
            .send({ description: 'Operario sin casco' });

        expect(res.status).toBe(401);
    });

    it('debe rechazar si no hay imagen ni descripción', async () => {
        const res = await request(app)
            .post('/api/inspections/analyze')
            .set(auth())
            .send({ plant: 'Planta Norte' });

        expect(res.status).toBe(400);
    });

    it('debe analizar descripción de texto y devolver riesgos', async () => {
        const res = await request(app)
            .post('/api/inspections/analyze')
            .set(auth())
            .send({
                description: 'Operario sin casco trabajando cerca de maquinaria pesada',
                plant: 'Planta Norte',
                sector: 'Producción L1',
            });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.risks).toBeDefined();
        expect(res.body.risks.length).toBeGreaterThan(0);
        expect(res.body.model).toBeDefined();

        // Verificar estructura del riesgo
        const risk = res.body.risks[0];
        expect(risk).toHaveProperty('id');
        expect(risk).toHaveProperty('category');
        expect(risk).toHaveProperty('description');
        expect(risk).toHaveProperty('level');
        expect(risk).toHaveProperty('confidence');
        expect(['epp', 'condiciones', 'comportamiento']).toContain(risk.category);
        expect(['alto', 'medio', 'bajo']).toContain(risk.level);
        expect(risk.confidence).toBeGreaterThanOrEqual(60);
        expect(risk.confidence).toBeLessThanOrEqual(99);
    });
});

describe('POST /api/inspections/create', () => {
    it('debe rechazar si faltan campos obligatorios', async () => {
        const res = await request(app)
            .post('/api/inspections/create')
            .set(auth())
            .send({ sector: 'Producción' });

        expect(res.status).toBe(400);
    });

    it('debe crear inspección correctamente', async () => {
        const res = await request(app)
            .post('/api/inspections/create')
            .set(auth())
            .send({
                plant: 'Planta Norte',
                sector: 'Producción L1',
                operator: 'Juan Pérez',
                risks: [{
                    id: 'risk-001',
                    category: 'epp',
                    description: 'Sin casco',
                    level: 'alto',
                    confidence: 90,
                    status: 'pendiente',
                }],
                task: {
                    action: 'Proveer casco y verificar uso',
                    responsible: 'Supervisor de turno',
                    deadline: '4 hs',
                    status: 'pendiente',
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.inspectionId).toBeDefined();
    });
});

describe('GET /api/inspections/:id', () => {
    it('debe devolver 404 si no existe', async () => {
        const res = await request(app)
            .get('/api/inspections/non-existent-id')
            .set(auth());

        expect(res.status).toBe(404);
    });

    it('debe devolver 403 si la inspección es de otro tenant', async () => {
        // Precargar inspección de otro tenant
        mockDb._setInspection('cross-tenant-id', {
            inspectionId: 'cross-tenant-id',
            tenantId: 'other-tenant',
            risks: [],
            task: { status: 'pendiente' },
        });

        const res = await request(app)
            .get('/api/inspections/cross-tenant-id')
            .set(auth());

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied');
    });
});

describe('GET /api/inspections/list', () => {
    it('debe devolver lista vacía inicialmente', async () => {
        const res = await request(app)
            .get('/api/inspections/list')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.inspections).toEqual([]);
        expect(res.body.total).toBe(0);
    });
});

describe('DELETE /api/inspections/:id', () => {
    it('debe rechazar si la inspección es de otro tenant', async () => {
        mockDb._setInspection('other-id', {
            inspectionId: 'other-id',
            tenantId: 'different-tenant',
            risks: [],
            task: { status: 'pendiente' },
        });

        const res = await request(app)
            .delete('/api/inspections/other-id')
            .set(auth());

        expect(res.status).toBe(403);
    });
});
