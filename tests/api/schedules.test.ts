import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import '../mocks/db';
import { mockDb } from '../mocks/db';

let app: any;
let adminToken: string;

const SCHEDULE_PAYLOAD = {
    companyId:    'co-001',
    companyName:  'Empresa Test SA',
    inspectorId:  'insp-001',
    inspectorName: 'Carlos López',
    scheduledDate: '2026-06-01',
    recurrence:   'none',
    notes:        'Sin observaciones',
};

const SCHEDULE_ROW = {
    id:     'sched-001',
    status: 'programada',
    data: {
        companyId:    'co-001',
        companyName:  'Empresa Test SA',
        inspectorId:  'insp-001',
        inspectorName: 'Carlos López',
        scheduledDate: '2026-06-01',
        recurrence:   'none',
        createdAt:    '2026-01-01T00:00:00Z',
        rescheduleHistory: [],
    },
    scheduled_date: '2026-06-01',
    tenant_id: 'tenant-001',
};

beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    const { createApiApp } = await import('../../api/_app.js');
    app = await createApiApp();

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'testpass123' });
    adminToken = loginRes.body.token;
});

beforeEach(() => {
    mockDb._clear();
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

// ── GET /api/schedules/list ───────────────────────────────────────────────────

describe('GET /api/schedules/list', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app).get('/api/schedules/list');
        expect(res.status).toBe(401);
    });

    it('debe devolver lista vacía por defecto', async () => {
        const res = await request(app)
            .get('/api/schedules/list')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.schedules).toEqual([]);
    });

    it('debe devolver inspecciones programadas existentes', async () => {
        mockDb._setScheduleListRows([SCHEDULE_ROW]);

        const res = await request(app)
            .get('/api/schedules/list')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.schedules).toHaveLength(1);
        expect(res.body.schedules[0].id).toBe('sched-001');
        expect(res.body.schedules[0].status).toBe('programada');
    });
});

// ── POST /api/schedules/create ────────────────────────────────────────────────

describe('POST /api/schedules/create', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app)
            .post('/api/schedules/create')
            .send(SCHEDULE_PAYLOAD);
        expect(res.status).toBe(401);
    });

    it('debe rechazar si falta companyId', async () => {
        const res = await request(app)
            .post('/api/schedules/create')
            .set(auth())
            .send({ inspectorId: 'insp-001', scheduledDate: '2026-06-01' });

        expect(res.status).toBe(400);
    });

    it('debe rechazar si falta inspectorId', async () => {
        const res = await request(app)
            .post('/api/schedules/create')
            .set(auth())
            .send({ companyId: 'co-001', scheduledDate: '2026-06-01' });

        expect(res.status).toBe(400);
    });

    it('debe rechazar si falta scheduledDate', async () => {
        const res = await request(app)
            .post('/api/schedules/create')
            .set(auth())
            .send({ companyId: 'co-001', inspectorId: 'insp-001' });

        expect(res.status).toBe(400);
    });

    it('debe crear la inspección con datos válidos', async () => {
        const res = await request(app)
            .post('/api/schedules/create')
            .set(auth())
            .send(SCHEDULE_PAYLOAD);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.schedule).toBeDefined();
        expect(res.body.schedule.companyId).toBe('co-001');
        expect(res.body.schedule.status).toBe('programada');
        expect(res.body.schedule.id).toBeDefined();
    });
});

// ── PUT /api/schedules/:id ────────────────────────────────────────────────────

describe('PUT /api/schedules/:id', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app)
            .put('/api/schedules/sched-001')
            .send({ status: 'realizada' });
        expect(res.status).toBe(401);
    });

    it('debe devolver 404 si el schedule no existe', async () => {
        const res = await request(app)
            .put('/api/schedules/no-existe')
            .set(auth())
            .send({ status: 'realizada' });

        expect(res.status).toBe(404);
    });

    it('debe actualizar el status correctamente', async () => {
        mockDb._setSchedule('sched-001', SCHEDULE_ROW);

        const res = await request(app)
            .put('/api/schedules/sched-001')
            .set(auth())
            .send({ status: 'realizada' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.schedule.status).toBe('realizada');
    });
});

// ── DELETE /api/schedules/:id ─────────────────────────────────────────────────

describe('DELETE /api/schedules/:id', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app).delete('/api/schedules/sched-001');
        expect(res.status).toBe(401);
    });

    it('debe eliminar la inspección como admin', async () => {
        const res = await request(app)
            .delete('/api/schedules/sched-001')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
