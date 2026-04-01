import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import './../../tests/mocks/db';
import { mockDb } from '../mocks/db';

let app: any;

beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    const { createApiApp } = await import('../../api/_app.js');
    app = await createApiApp();
});

beforeEach(() => {
    mockDb.query.mockClear();
});

describe('POST /api/auth/login', () => {
    it('debe rechazar si faltan credenciales', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    it('debe rechazar credenciales inválidas', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'noexiste@test.com', password: 'wrong' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toBe('Invalid credentials');
    });

    it('debe devolver token con credenciales válidas', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@test.com', password: 'testpass123' });

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe('admin@test.com');
        expect(res.body.user).not.toHaveProperty('passwordHash');
    });
});

describe('GET /api/auth/me', () => {
    it('debe rechazar sin token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('debe rechazar token inválido', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
    });
});

describe('GET /api/ping', () => {
    it('debe responder con status ok', async () => {
        const res = await request(app).get('/api/ping');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.checks.api).toBe('ok');
        expect(res.body.checks.database).toBe('ok');
        expect(res.body.version).toBeDefined();
    });
});
