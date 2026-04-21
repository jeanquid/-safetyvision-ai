import express from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import db from './_db.js';
import { logger } from './_logger.js';
import { loginHandler } from './_auth/login.js';
import { meHandler } from './_auth/me.js';
import { authenticateToken } from './_auth/middleware.js';
import { getPhoto } from './_storage.js';
import { getTenant, updateTenantPlants } from './_tenant.js';
import {
    createCompany, listCompanies, getCompany, updateCompany,
    deleteCompany, getCompaniesWithStats, resetCompanyInspections
} from './_companies.js';
import { listUsersHandler, createUserHandler, updateUserHandler, deleteUserHandler } from './_auth/admin-handlers.js';
import { generateInspectionPDF } from './_pdf.js';
import { getInspection } from './_store.js';
import {
    analyzeHandler,
    createHandler,
    listHandler,
    getHandler,
    updateRiskHandler,
    updateTaskHandler,
    deleteHandler,
    dashboardHandler,
} from './_inspections/handlers.js';
import {
    createScheduleHandler,
    listSchedulesHandler,
    updateScheduleHandler,
    deleteScheduleHandler
} from './_schedules.js';

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
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS,PUT,PATCH');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-AI-Model'
        );
        if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
        next();
    });

    // ── Security Headers ──
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '0');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
        next();
    });

    // ── Body Parser ──
    app.use(bodyParser.json({ limit: '20mb' }));
    app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

    // ── Logging ──
    app.use((req, _res, next) => {
        try {
            const size = req.body ? JSON.stringify(req.body).length : 0;
            logger.info('http', `${req.method} ${req.path}`, { sizeKB: +(size / 1024).toFixed(1) });
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
    app.get('/api/ping', async (_req, res) => {
        const checks: Record<string, string> = {
            api: 'ok',
            database: 'unknown',
            gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
        };

        try {
            await db.query('SELECT 1');
            checks.database = 'ok';
        } catch {
            checks.database = 'error';
        }

        const allOk = checks.api === 'ok' && checks.database === 'ok';

        res.status(allOk ? 200 : 503).json({
            status: allOk ? 'ok' : 'degraded',
            platform: 'SafetyVision AI',
            version: '1.1.0',
            checks,
            time: new Date().toISOString(),
        });
    });

    // ── Auth Routes ──
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 10,                   // máximo 10 intentos por IP
        message: { ok: false, error: 'Demasiados intentos. Esperá 15 minutos.' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.post(['/api/auth/login', '/auth/login'], loginLimiter, loginHandler);
    app.get(['/api/auth/me', '/auth/me'], safeAuth, meHandler);

    // NUEVO: Rate limiter para análisis de imágenes (endpoint más caro — llama a Gemini)
    const analyzeLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,  // ventana de 1 hora
        max: 50,                    // máximo 50 análisis por hora por IP
        message: { ok: false, error: 'Demasiados análisis. Límite: 50 por hora. Intentá más tarde.' },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: any) => {
            // Limitar por usuario autenticado si existe, sino por IP
            return req.user?.userId || req.ip || 'unknown';
        },
    });

    // ── Inspection Routes ──
    const insRouter = express.Router();
    insRouter.post('/analyze', safeAuth, analyzeLimiter, analyzeHandler);
    insRouter.post('/create', safeAuth, createHandler);
    insRouter.get('/list', safeAuth, listHandler);
    insRouter.get('/:id', safeAuth, getHandler);
    insRouter.patch('/:id/risks/:riskId', safeAuth, updateRiskHandler);
    insRouter.post('/:id/update-task', safeAuth, updateTaskHandler);
    insRouter.delete('/:id', safeAuth, deleteHandler);
    app.use('/api/inspections', insRouter);
    app.use('/inspections', insRouter);

    // ── Photo Serving ──
    app.get('/api/photos/:id', safeAuth, async (req, res) => {
        try {
            const photo = await getPhoto(req.params.id as string);
            if (!photo) return res.status(404).json({ error: 'Photo not found' });

            const buffer = Buffer.from(photo.data, 'base64');
            res.setHeader('Content-Type', photo.mimeType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(buffer);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/inspections/:id/pdf', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            const inspection = await getInspection(req.params.id as string);

            if (!inspection) return res.status(404).json({ error: 'Not found' });
            if (inspection.tenantId !== user.tenantId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const pdf = await generateInspectionPDF(inspection);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="inspeccion-${inspection.inspectionId.substring(0, 8)}.pdf"`
            );
            res.send(pdf);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // ── Tenant Config Routes ──
    app.get('/api/config', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            const tenant = await getTenant(user.tenantId);

            if (!tenant) {
                // Fallback: devolver config hardcodeada para compatibilidad
                return res.json({
                    ok: true,
                    tenant: {
                        tenantId: user.tenantId,
                        name: 'Mi Empresa',
                        plants: [
                            { name: 'Planta Norte', sectors: ['Producción L1', 'Producción L2', 'Almacén', 'Despacho', 'Mantenimiento'] },
                            { name: 'Planta Sur', sectors: ['Producción', 'Envasado', 'Depósito', 'Laboratorio'] },
                            { name: 'Planta Central', sectors: ['Oficinas', 'Producción', 'Calderas', 'Subestación eléctrica'] },
                            { name: 'Obra Externa', sectors: ['Frente de obra', 'Obrador', 'Acopio'] },
                        ],
                    },
                });
            }

            res.json({ ok: true, tenant });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/config/plants', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            if (user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin only' });
            }

            const { plants } = req.body;

            if (!Array.isArray(plants) || plants.length === 0) {
                return res.status(400).json({ error: 'plants must be a non-empty array' });
            }

            // Validar estructura
            for (const plant of plants) {
                if (!plant.name || typeof plant.name !== 'string') {
                    return res.status(400).json({ error: 'Each plant must have a name' });
                }
                if (!Array.isArray(plant.sectors) || plant.sectors.length === 0) {
                    return res.status(400).json({ error: `Plant "${plant.name}" must have at least one sector` });
                }
            }

            const updated = await updateTenantPlants(user.tenantId, plants);
            if (!updated) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            res.json({ ok: true, plants });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // ── Company Routes ──
    const companyRouter = express.Router();

    // Listar empresas con stats (para el dashboard)
    companyRouter.get('/list', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            const companies = await getCompaniesWithStats(user.tenantId, user);
            res.json({ ok: true, companies });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Obtener empresa por ID (con detalle)
    companyRouter.get('/:id', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            const company = await getCompany(req.params.id);
            if (!company) return res.status(404).json({ error: 'Company not found' });
            if (company.tenantId !== user.tenantId) return res.status(403).json({ error: 'Access denied' });
            res.json({ ok: true, company });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Crear empresa
    companyRouter.post('/create', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            const { name, rut, address, contactName, contactPhone, plants, notes } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });

            const company = await createCompany({
                tenantId: user.tenantId, name, rut, address,
                contactName, contactPhone, plants, notes,
            });
            res.json({ ok: true, company });
        } catch (error: any) {
            if (error.message?.includes('duplicate key')) {
                return res.status(409).json({ error: 'Ya existe una empresa con ese nombre' });
            }
            res.status(500).json({ error: error.message });
        }
    });

    // Actualizar empresa
    companyRouter.put('/:id', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            const company = await getCompany(req.params.id);
            if (!company) return res.status(404).json({ error: 'Company not found' });
            if (company.tenantId !== user.tenantId) return res.status(403).json({ error: 'Access denied' });

            await updateCompany(req.params.id, req.body);
            const updated = await getCompany(req.params.id);
            res.json({ ok: true, company: updated });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Resetear inspecciones de una empresa (borrar todas)
    companyRouter.post('/:id/reset', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

            const company = await getCompany(req.params.id);
            if (!company) return res.status(404).json({ error: 'Company not found' });
            if (company.tenantId !== user.tenantId) return res.status(403).json({ error: 'Access denied' });

            const deleted = await resetCompanyInspections(req.params.id);
            res.json({ ok: true, deletedInspections: deleted });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Eliminar empresa (soft delete)
    companyRouter.delete('/:id', safeAuth, async (req, res) => {
        try {
            const user = (req as any).user;
            if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

            const company = await getCompany(req.params.id);
            if (!company) return res.status(404).json({ error: 'Company not found' });
            if (company.tenantId !== user.tenantId) return res.status(403).json({ error: 'Access denied' });

            await deleteCompany(req.params.id);
            res.json({ ok: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.use('/api/companies', companyRouter);

    // ── Schedule Routes ──
    const scheduleRouter = express.Router();
    scheduleRouter.post('/create', safeAuth, createScheduleHandler);
    scheduleRouter.get('/list', safeAuth, listSchedulesHandler);
    scheduleRouter.put('/:id', safeAuth, updateScheduleHandler);
    scheduleRouter.delete('/:id', safeAuth, deleteScheduleHandler);
    app.use('/api/schedules', scheduleRouter);

    // ── Dashboard ──
    app.get(['/api/dashboard', '/dashboard'], safeAuth, dashboardHandler);

    // ── Admin Routes ──
    app.get('/api/users', safeAuth, listUsersHandler);
    app.post('/api/users', safeAuth, createUserHandler);
    app.put('/api/users/:id', safeAuth, updateUserHandler);
    app.delete('/api/users/:id', safeAuth, deleteUserHandler);

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
        logger.error('express', 'Global server error', { error: err.message, stack: err.stack });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server error', details: err.message });
        }
    });

    return app;
}
