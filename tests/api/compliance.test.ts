import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import './../../tests/mocks/db';
import './../../tests/mocks/gemini';
import { mockDb } from '../mocks/db';
import { generateSeal } from '../../api/_store.js';
import { AuditEntry } from '../../api/_types.js';
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

describe('Compliance API Endpoints', () => {

    describe('GET /api/inspections/:id/verify', () => {
        it('debe rechazar acceso si no es admin', async () => {
            const res = await request(app)
                .get('/api/inspections/some-id/verify');
            expect(res.status).toBe(401); // Sin auth es 401
        });

        it('debe verificar cadena intacta y válida v2', async () => {
            const inspectionId = uuidv4();
            
            const entry1: Omit<AuditEntry, 'seal'> = {
                id: uuidv4(),
                riskId: 'inspection',
                action: 'inspection_created',
                fromStatus: undefined,
                toStatus: undefined,
                note: 'Inspección creada',
                inspectorId: 'test-user-id-001',
                inspectorEmail: 'admin@test.com',
                inspectorName: 'Test Admin',
                timestamp: new Date().toISOString(),
                photoHash: 'hash-foto-123',
                sealVersion: 2
            };
            const seal1 = await generateSeal(entry1, '0000000000000000000000000000000000000000000000000000000000000000');
            const sealed1: AuditEntry = { ...entry1, seal: seal1 };

            const inspectionState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [sealed1],
                risks: [],
                photoUrl: 'photo:photo-001'
            };

            mockDb._setInspection(inspectionId, inspectionState);
            
            const res = await request(app)
                .get(`/api/inspections/${inspectionId}/verify`)
                .set(auth());

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.valid).toBe(true);
            expect(res.body.isLegacy).toBe(false);
        });

        it('debe detectar alteraciones en la cadena', async () => {
            const inspectionId = uuidv4();
            
            const entry1: Omit<AuditEntry, 'seal'> = {
                id: uuidv4(),
                riskId: 'inspection',
                action: 'inspection_created',
                fromStatus: undefined,
                toStatus: undefined,
                note: 'Inspección creada',
                inspectorId: 'test-user-id-001',
                inspectorEmail: 'admin@test.com',
                inspectorName: 'Test Admin',
                timestamp: new Date().toISOString(),
                photoHash: 'hash-foto-123',
                sealVersion: 2
            };
            const sealed1: AuditEntry = { ...entry1, seal: 'altered-seal-value-1234567890' }; // altered seal

            const inspectionState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [sealed1],
                risks: [],
                photoUrl: 'photo:photo-001'
            };

            mockDb._setInspection(inspectionId, inspectionState);

            const res = await request(app)
                .get(`/api/inspections/${inspectionId}/verify`)
                .set(auth());

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.valid).toBe(false);
        });

        it('debe catalogar como legacy v1 si el sello es de 16 caracteres', async () => {
            const inspectionId = uuidv4();
            
            const entry1: Omit<AuditEntry, 'seal'> = {
                id: uuidv4(),
                riskId: 'inspection',
                action: 'inspection_created',
                inspectorId: 'test-user-id-001',
                inspectorEmail: 'admin@test.com',
                inspectorName: 'Test Admin',
                timestamp: new Date().toISOString(),
                sealVersion: 1
            };
            const seal1 = await generateSeal(entry1, '0000000000000000');
            const sealed1: AuditEntry = { ...entry1, seal: seal1 };

            const inspectionState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [sealed1],
                risks: [],
                photoUrl: 'photo:photo-001'
            };

            mockDb._setInspection(inspectionId, inspectionState);

            const res = await request(app)
                .get(`/api/inspections/${inspectionId}/verify`)
                .set(auth());

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.valid).toBe(true);
            expect(res.body.isLegacy).toBe(true);
        });
    });

    describe('GET /api/inspections/:id/export', () => {
        it('debe exportar en JSON', async () => {
            const inspectionId = uuidv4();
            const inspectionState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [],
                risks: []
            };
            mockDb._setInspection(inspectionId, inspectionState);

            const res = await request(app)
                .get(`/api/inspections/${inspectionId}/export?format=json`)
                .set(auth());

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/json');
            expect(res.body.inspectionId).toBe(inspectionId);
        });

        it('debe exportar en CSV', async () => {
            const inspectionId = uuidv4();
            const inspectionState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [],
                risks: [{
                    id: 'r-001',
                    category: 'epp',
                    description: 'Sin casco',
                    level: 'alto',
                    status: 'pendiente',
                    recommendation: 'Usar casco'
                }]
            };
            mockDb._setInspection(inspectionId, inspectionState);

            const res = await request(app)
                .get(`/api/inspections/${inspectionId}/export?format=csv`)
                .set(auth());

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text).toContain(inspectionId);
            expect(res.text).toContain('Sin casco');
        });
    });

    describe('GET /api/verify/:publicId', () => {
        it('debe devolver constancia publica JSON sin autenticacion', async () => {
            const inspectionId = uuidv4();
            const publicId = 'random-public-id-hash-string-abc';
            
            mockDb._setComplianceRecord(publicId, {
                id: uuidv4(),
                inspection_id: inspectionId,
                public_id: publicId,
                closing_hash: 'closing-hash-v2-xyz',
                chain_valid: true,
                tenant_id: 'tenant-001',
                issued_at: new Date().toISOString()
            });

            const inspectionState = {
                inspectionId,
                tenantId: 'tenant-001',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Norte',
                sector: 'Sector A',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [],
                risks: []
            };
            mockDb._setInspection(inspectionId, inspectionState);

            const res = await request(app)
                .get(`/api/verify/${publicId}`);

            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.publicId).toBe(publicId);
            expect(res.body.tenant).toBe('Test Tenant S.E.');
            expect(res.body.chainStatus).toBe('valid');
            expect(res.body.risks).toBeUndefined();
            expect(res.body.photoUrl).toBeUndefined();
            expect(res.body.operator).toBeUndefined();
        });

        it('debe devolver HTML con estilo ENSI si se solicita por Accept header', async () => {
            const inspectionId = uuidv4();
            const publicId = 'random-public-id-hash-string-html';
            
            mockDb._setComplianceRecord(publicId, {
                id: uuidv4(),
                inspection_id: inspectionId,
                public_id: publicId,
                closing_hash: 'closing-hash-v2-xyz',
                chain_valid: true,
                tenant_id: 'ensi', // ENSI tenant
                issued_at: new Date().toISOString()
            });

            const inspectionState = {
                inspectionId,
                tenantId: 'ensi',
                userId: 'test-user-id-001',
                companyId: 'co-001',
                plant: 'Planta Arroyito',
                sector: 'Calderas',
                operator: 'Test Admin',
                status: 'closed',
                task: { status: 'resuelto' },
                auditTrail: [],
                risks: []
            };
            mockDb._setInspection(inspectionId, inspectionState);

            const res = await request(app)
                .get(`/api/verify/${publicId}`)
                .set('Accept', 'text/html');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/html');
            expect(res.text).toContain('Constancia de Integridad');
            expect(res.text).toContain('ENSI S.E. · SafetyField');
            expect(res.text).toContain('Planta Arroyito');
        });
    });
});
