import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import '../mocks/db';
import { mockDb } from '../mocks/db';

let app: any;
let adminToken: string;

const COMPANY_ROW = {
    company_id: 'co-001',
    tenant_id: 'tenant-001',
    name: 'Empresa Test SA',
    rut: '30-123456-7',
    address: 'Av. Test 123',
    contact_name: 'Juan Pérez',
    contact_phone: '011-1234-5678',
    plants: [{ name: 'Planta Principal', sectors: ['General'] }],
    notes: null,
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
};

const COMPANY_LIST_ROW = {
    company_id: 'co-001',
    name: 'Empresa Test SA',
    total_inspections: '5',
    total_risks: '10',
    high_risks: '2',
    pending_tasks: '3',
    resolved_tasks: '2',
    last_inspection_date: null,
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

// ── GET /api/companies/list ───────────────────────────────────────────────────

describe('GET /api/companies/list', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app).get('/api/companies/list');
        expect(res.status).toBe(401);
    });

    it('debe devolver lista vacía por defecto', async () => {
        const res = await request(app)
            .get('/api/companies/list')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.companies).toEqual([]);
    });

    it('debe devolver empresas con stats correctas', async () => {
        mockDb._setCompanyListRows([COMPANY_LIST_ROW]);

        const res = await request(app)
            .get('/api/companies/list')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.companies).toHaveLength(1);
        const co = res.body.companies[0];
        expect(co.companyId).toBe('co-001');
        expect(co.name).toBe('Empresa Test SA');
        expect(co.totalInspections).toBe(5);
        expect(co.highRisks).toBe(2);
    });
});

// ── GET /api/companies/:id ────────────────────────────────────────────────────

describe('GET /api/companies/:id', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app).get('/api/companies/co-001');
        expect(res.status).toBe(401);
    });

    it('debe devolver 404 si la empresa no existe', async () => {
        const res = await request(app)
            .get('/api/companies/no-existe')
            .set(auth());

        expect(res.status).toBe(404);
    });

    it('debe devolver 403 si la empresa es de otro tenant', async () => {
        mockDb._setCompany('co-cross', { ...COMPANY_ROW, company_id: 'co-cross', tenant_id: 'other-tenant' });

        const res = await request(app)
            .get('/api/companies/co-cross')
            .set(auth());

        expect(res.status).toBe(403);
    });

    it('debe devolver la empresa si existe y pertenece al tenant', async () => {
        mockDb._setCompany('co-001', COMPANY_ROW);

        const res = await request(app)
            .get('/api/companies/co-001')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.company.companyId).toBe('co-001');
        expect(res.body.company.name).toBe('Empresa Test SA');
    });
});

// ── POST /api/companies/create ────────────────────────────────────────────────

describe('POST /api/companies/create', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app)
            .post('/api/companies/create')
            .send({ name: 'Nueva Empresa' });
        expect(res.status).toBe(401);
    });

    it('debe rechazar si falta el nombre', async () => {
        const res = await request(app)
            .post('/api/companies/create')
            .set(auth())
            .send({ address: 'Alguna dirección' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/name/i);
    });

    it('debe crear empresa con nombre válido', async () => {
        const res = await request(app)
            .post('/api/companies/create')
            .set(auth())
            .send({ name: 'Empresa Nueva SA', rut: '20-111222-3', address: 'Calle 1' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.company).toBeDefined();
        expect(res.body.company.name).toBe('Empresa Nueva SA');
        expect(res.body.company.status).toBe('active');
    });
});

// ── DELETE /api/companies/:id ─────────────────────────────────────────────────

describe('DELETE /api/companies/:id', () => {
    it('debe rechazar sin autenticación', async () => {
        const res = await request(app).delete('/api/companies/co-001');
        expect(res.status).toBe(401);
    });

    it('debe devolver 404 si la empresa no existe', async () => {
        const res = await request(app)
            .delete('/api/companies/no-existe')
            .set(auth());

        expect(res.status).toBe(404);
    });

    it('debe devolver 403 si la empresa es de otro tenant', async () => {
        mockDb._setCompany('co-cross', { ...COMPANY_ROW, company_id: 'co-cross', tenant_id: 'other-tenant' });

        const res = await request(app)
            .delete('/api/companies/co-cross')
            .set(auth());

        expect(res.status).toBe(403);
    });

    it('debe archivar la empresa correctamente', async () => {
        mockDb._setCompany('co-001', COMPANY_ROW);

        const res = await request(app)
            .delete('/api/companies/co-001')
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
