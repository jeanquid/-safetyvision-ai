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
        migrated = true;
    } catch {
        // La tabla no existe o falta algo — correr migración ligera e idempotente
        logger.warn('init', 'Running auto-migration (missing tables detected)');

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

        await db.query(`CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);`);
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_tenant ON companies(tenant_id, name);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspections(company_id);`);

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
