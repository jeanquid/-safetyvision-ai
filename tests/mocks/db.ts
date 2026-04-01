import { vi } from 'vitest';

// Simula respuestas de PostgreSQL
const mockQueryResponses = new Map<string, any>();

export const mockDb = {
    query: vi.fn(async (sql: string, params?: any[]) => {
        // Login: user lookup
        if (sql.includes('SELECT * FROM users WHERE email')) {
            const email = params?.[0];
            if (email === 'admin@test.com') {
                return {
                    rows: [{
                        id: 'test-user-id-001',
                        email: 'admin@test.com',
                        password_hash: '$2a$12$LJ3m4ys3GZfkM1NdD.6VxODQWGYOI7G6pL5.R8fYy0P5vQ3nW3UZi', // "testpass123"
                        role: 'admin',
                        tenant_id: 'tenant-001',
                        display_name: 'Test Admin',
                        created_at: '2025-01-01T00:00:00Z',
                    }],
                };
            }
            return { rows: [] };
        }

        // Inspection insert
        if (sql.includes('INSERT INTO inspections')) {
            return { rows: [], rowCount: 1 };
        }

        // Inspection select by ID
        if (sql.includes('SELECT state FROM inspections WHERE inspection_id')) {
            const stored = mockQueryResponses.get(`inspection:${params?.[0]}`);
            if (stored) return { rows: [{ state: stored }] };
            return { rows: [] };
        }

        // Count query (for pagination)
        if (sql.includes('SELECT COUNT(*)')) {
            return { rows: [{ count: '0' }] };
        }

        // List inspections
        if (sql.includes('SELECT state FROM inspections') && sql.includes('ORDER BY')) {
            return { rows: [] };
        }

        // Health check
        if (sql === 'SELECT 1') {
            return { rows: [{ '?column?': 1 }] };
        }

        // Photos table
        if (sql.includes('INSERT INTO photos')) {
            return { rows: [], rowCount: 1 };
        }

        // Default
        return { rows: [] };
    }),

    end: vi.fn(),

    // Helper para precargar datos en el mock
    _setInspection: (id: string, state: any) => {
        mockQueryResponses.set(`inspection:${id}`, state);
    },

    _clear: () => {
        mockQueryResponses.clear();
        mockDb.query.mockClear();
    },
};

// Mock del módulo _db
vi.mock('../../api/_db.js', () => ({
    default: mockDb,
    db: mockDb,
}));
