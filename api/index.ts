import { createApiApp } from './_app.js';
import { logger } from './_logger.js';
import db from './_db.js';

logger.info('init', 'SafetyVision API initializing');

let cachedApp: any = null;
let migrated = false;

async function ensureTables() {
    if (migrated) return;
    try {
        // Quick check: si companies existe, todo está OK
        await db.query('SELECT 1 FROM companies LIMIT 0');
        
        // Pero también debemos verificar si están las columnas nuevas de users
        try {
            await db.query('SELECT full_name FROM users LIMIT 0');
        } catch {
            throw new Error('Missing user columns');
        }

        migrated = true;
    } catch {
        // La tabla no existe o falta algo — correr migración ligera e idempotente
        logger.warn('init', 'Running auto-migration (missing tables or columns detected)');

        await db.query(`
            CREATE TABLE IF NOT EXISTS companies (
                company_id UUID PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                rut TEXT,
                address TEXT,
                contact_name TEXT,
                contact_phone TEXT,
                plants JSONB NOT NULL DEFAULT '[]',
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            ALTER TABLE inspections
            ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(company_id);
        `);

        // Migration for users signature fields
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS full_name TEXT,
            ADD COLUMN IF NOT EXISTS license_number TEXT,
            ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT 'Inspector de Seguridad e Higiene';
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS ai_feedback (
                id UUID PRIMARY KEY,
                inspection_id UUID REFERENCES inspections(inspection_id) ON DELETE CASCADE,
                tenant_id TEXT NOT NULL,
                ai_risks JSONB NOT NULL,
                final_risks JSONB NOT NULL,
                risks_accepted INT DEFAULT 0,
                risks_edited INT DEFAULT 0,
                risks_removed INT DEFAULT 0,
                risks_added INT DEFAULT 0,
                plant TEXT,
                sector TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant ON ai_feedback(tenant_id);`);

        migrated = true;
        logger.info('init', 'Auto-migration complete');
    }
}

export default async function handler(req: any, res: any) {
    try {
        await ensureTables();

        if (!cachedApp) {
            cachedApp = await createApiApp();
            logger.info('init', 'API instance created and cached');
        }
        return cachedApp(req, res);
    } catch (error: any) {
        logger.error('init', 'API crash', { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server crash', message: error.message });
        }
    }
}
