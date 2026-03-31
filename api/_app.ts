import express from 'express';
import bodyParser from 'body-parser';
import { loginHandler } from './_auth/login.js';
import { meHandler } from './_auth/me.js';
import { authenticateToken } from './_auth/middleware.js';
import {
    analyzeHandler,
    createHandler,
    listHandler,
    getHandler,
    updateTaskHandler,
    deleteHandler,
    dashboardHandler,
} from './_inspections/handlers.js';

export async function createApiApp() {
    const app = express();

    // ── CORS ──
    const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
        .split(',').map(o => o.trim()).filter(Boolean);

    app.use((req, res, next) => {
        const origin = req.headers.origin || '';
        if (ALLOWED_ORIGINS.includes(origin) || !origin) {
            if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS,PUT');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-AI-Model'
        );
        if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
        next();
    });

    // ── Body Parser ──
    app.use(bodyParser.json({ limit: '20mb' }));
    app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

    // ── Logging ──
    app.use((req, _res, next) => {
        try {
            const size = req.body ? JSON.stringify(req.body).length : 0;
            console.log(`[API] ${req.method} ${req.path} | ${(size / 1024).toFixed(1)}KB`);
        } catch {}
        next();
    });

    const safeAuth = (req: any, res: any, next: any) => {
        authenticateToken(req, res, (err?: any) => {
            if (err) return res.status(500).json({ error: 'Auth error' });
            next();
        });
    };

    // ── Health ──
    app.get('/api/ping', (_req, res) => res.json({
        status: 'ok',
        platform: 'SafetyVision AI',
        version: '1.0.0',
        time: new Date().toISOString()
    }));

    // ── Auth Routes ──
    app.post(['/api/auth/login', '/auth/login'], loginHandler);
    app.get(['/api/auth/me', '/auth/me'], safeAuth, meHandler);

    // ── Inspection Routes ──
    const insRouter = express.Router();
    insRouter.post('/analyze', safeAuth, analyzeHandler);
    insRouter.post('/create', safeAuth, createHandler);
    insRouter.get('/list', safeAuth, listHandler);
    insRouter.get('/:id', safeAuth, getHandler);
    insRouter.post('/:id/update-task', safeAuth, updateTaskHandler);
    insRouter.delete('/:id', safeAuth, deleteHandler);
    app.use('/api/inspections', insRouter);
    app.use('/inspections', insRouter);

    // ── Dashboard ──
    app.get(['/api/dashboard', '/dashboard'], safeAuth, dashboardHandler);

    // ── Test Gemini connectivity ──
    app.post(['/api/test-model', '/test-model'], safeAuth, async (req, res) => {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const result = await model.generateContent('Respondé solo con: "SafetyVision AI OK"');
            const text = result.response.text();
            res.json({ ok: true, response: text, model: 'gemini-2.0-flash' });
        } catch (err: any) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── Global Error Handler ──
    app.use((err: any, _req: any, res: any, _next: any) => {
        console.error('[GLOBAL_ERR]', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server error', details: err.message });
        }
    });

    return app;
}
