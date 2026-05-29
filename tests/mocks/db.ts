import { vi } from 'vitest';

// Mock bcrypt — avoids real hash computation, login succeeds con 'testpass123'
vi.mock('bcryptjs', () => ({
    default: {
        compare:     vi.fn(async (pw: string) => pw === 'testpass123'),
        compareSync: vi.fn((pw: string) => pw === 'testpass123'),
        hash:        vi.fn(async (pw: string) => `mock_hash_${pw}`),
        hashSync:    vi.fn((pw: string) => `mock_hash_${pw}`),
    },
}));

const mockInspections = new Map<string, any>();
const mockCompanies   = new Map<string, any>();
const mockSchedules   = new Map<string, any>();
const mockComplianceRecords = new Map<string, any>();
const mockTenants = new Map<string, any>([
    ['tenant-001', { name: 'Test Tenant S.E.' }],
    ['ensi', { name: 'ENSI S.E.' }]
]);
let mockCompanyListRows: any[] = [];
let mockScheduleListRows: any[] = [];

const MOCK_ADMIN = {
    id: 'test-user-id-001',
    email: 'admin@test.com',
    password_hash: 'mock_hash_testpass123',
    role: 'admin',
    tenant_id: 'tenant-001',
    display_name: 'Test Admin',
    created_at: '2025-01-01T00:00:00Z',
};

export const mockDb = {
    query: vi.fn(async (sql: string, params?: any[]) => {

        // ── Auth / Users ──────────────────────────────────────────────────────
        if (sql.includes('SELECT * FROM users WHERE email')) {
            return params?.[0] === 'admin@test.com'
                ? { rows: [{ ...MOCK_ADMIN }] }
                : { rows: [] };
        }

        if (sql.includes('SELECT * FROM users WHERE id')) {
            return params?.[0] === 'test-user-id-001'
                ? { rows: [{ ...MOCK_ADMIN }] }
                : { rows: [] };
        }

        if (sql.includes('SELECT assigned_companies FROM users')) {
            return { rows: [{ assigned_companies: [] }] };
        }

        // ── Companies (stats JOIN query) ──────────────────────────────────────
        if (sql.includes('FROM companies c') && sql.includes('LEFT JOIN')) {
            return { rows: mockCompanyListRows };
        }

        if (sql.includes('SELECT * FROM companies WHERE company_id')) {
            const row = mockCompanies.get(params?.[0]);
            return row ? { rows: [row] } : { rows: [] };
        }

        if (sql.includes('INSERT INTO companies')) {
            return { rows: [], rowCount: 1 };
        }

        if (sql.includes('UPDATE companies')) {
            return { rows: [], rowCount: 1 };
        }

        // ── Inspections ───────────────────────────────────────────────────────
        if (sql.includes('INSERT INTO inspections')) {
            return { rows: [], rowCount: 1 };
        }

        if (sql.includes('SELECT state FROM inspections WHERE inspection_id')) {
            const state = mockInspections.get(`inspection:${params?.[0]}`);
            return state ? { rows: [{ state }] } : { rows: [] };
        }

        if (sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ count: '0' }] };
        }

        if (sql.includes('SELECT state FROM inspections') && sql.includes('ORDER BY')) {
            return { rows: [] };
        }

        // ── Schedules ─────────────────────────────────────────────────────────
        if (sql.includes('INSERT INTO schedules')) {
            return { rows: [], rowCount: 1 };
        }

        if (sql.includes('SELECT id, status, data FROM schedules')) {
            return { rows: mockScheduleListRows };
        }

        if (sql.includes('SELECT * FROM schedules WHERE id')) {
            const row = mockSchedules.get(params?.[0]);
            return row ? { rows: [row] } : { rows: [] };
        }

        if (sql.includes('UPDATE schedules')) {
            return { rows: [], rowCount: 1 };
        }

        if (sql.includes('DELETE FROM schedules')) {
            return { rows: [], rowCount: 1 };
        }

        // ── Photos ────────────────────────────────────────────────────────────
        if (sql.includes('INSERT INTO photos')) {
            return { rows: [], rowCount: 1 };
        }
        if (sql.includes('SELECT photo_hash FROM photos')) {
            return { rows: [{ photo_hash: 'hash-foto-123' }] };
        }

        // ── Compliance / Tenants / Logs ──────────────────────────────────────
        if (sql.includes('SELECT * FROM compliance_records WHERE public_id')) {
            const row = mockComplianceRecords.get(`public:${params?.[0]}`);
            return row ? { rows: [row] } : { rows: [] };
        }

        if (sql.includes('SELECT public_id FROM compliance_records WHERE inspection_id')) {
            const row = Array.from(mockComplianceRecords.values()).find((r: any) => r.inspection_id === params?.[0]);
            return row ? { rows: [{ public_id: row.public_id }] } : { rows: [] };
        }

        if (sql.includes('INSERT INTO compliance_records')) {
            const [id, inspection_id, public_id, closing_hash, chain_valid, tenant_id] = params || [];
            const record = { id, inspection_id, public_id, closing_hash, chain_valid, tenant_id, issued_at: new Date().toISOString() };
            mockComplianceRecords.set(`public:${public_id}`, record);
            return { rows: [], rowCount: 1 };
        }

        if (sql.includes('UPDATE compliance_records SET chain_valid')) {
            const [chain_valid, public_id] = params || [];
            const record = mockComplianceRecords.get(`public:${public_id}`);
            if (record) {
                record.chain_valid = chain_valid;
            }
            return { rows: [], rowCount: 1 };
        }

        if (sql.includes('SELECT name FROM tenants WHERE tenant_id')) {
            const row = mockTenants.get(params?.[0]) || { name: 'ENSI S.E.' };
            return { rows: [row] };
        }

        if (sql.includes('INSERT INTO audit_access_logs')) {
            return { rows: [], rowCount: 1 };
        }

        // ── Health ────────────────────────────────────────────────────────────
        if (sql === 'SELECT 1') {
            return { rows: [{ '?column?': 1 }] };
        }

        return { rows: [] };
    }),

    end: vi.fn(),

    _setInspection: (id: string, state: any) => {
        mockInspections.set(`inspection:${id}`, state);
    },

    _setCompany: (id: string, row: any) => {
        mockCompanies.set(id, row);
    },

    _setCompanyListRows: (rows: any[]) => {
        mockCompanyListRows = rows;
    },

    _setSchedule: (id: string, row: any) => {
        mockSchedules.set(id, row);
    },

    _setScheduleListRows: (rows: any[]) => {
        mockScheduleListRows = rows;
    },

    _setComplianceRecord: (publicId: string, record: any) => {
        mockComplianceRecords.set(`public:${publicId}`, record);
    },

    _clear: () => {
        mockInspections.clear();
        mockCompanies.clear();
        mockSchedules.clear();
        mockComplianceRecords.clear();
        mockCompanyListRows = [];
        mockScheduleListRows = [];
        mockDb.query.mockClear();
    },
};

vi.mock('../../api/_db.js', () => ({
    default: mockDb,
    db: mockDb,
}));
