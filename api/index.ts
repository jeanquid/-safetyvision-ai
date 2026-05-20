import { createApiApp } from './_app.js';
import { logger } from './_logger.js';
import db from './_db.js';
import { seedUsers } from './_auth/store.js';

logger.info('init', 'SafetyVision API initializing');

let cachedApp: any = null;
let migrated = false;

async function ensureTables() {
    if (migrated) return;
    try {
        // Quick check: verificar que todas las tablas y columnas críticas existan
        await db.query('SELECT 1 FROM tenants LIMIT 0');
        await db.query('SELECT 1 FROM users LIMIT 0');
        await db.query('SELECT 1 FROM companies LIMIT 0');
        await db.query('SELECT 1 FROM inspections LIMIT 0');
        await db.query('SELECT 1 FROM photos LIMIT 0');
        await db.query('SELECT 1 FROM audit_trail LIMIT 0');
        await db.query('SELECT 1 FROM ai_feedback LIMIT 0');
        await db.query('SELECT 1 FROM schedules LIMIT 0');

        // Verificar columnas añadidas por migraciones
        await db.query('SELECT full_name, assigned_companies FROM users LIMIT 0');
        await db.query('SELECT company_id FROM inspections LIMIT 0');

        // Si la tabla de usuarios está vacía, forzar el sembrado de usuarios por defecto
        const userCountRes = await db.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(userCountRes.rows[0]?.count || '0', 10);
        if (userCount === 0) {
            logger.info('init', 'Database tables exist but users table is empty. Running seedUsers...');
            await seedUsers();
        }

        // Si el tenant demo no existe, crearlo
        const tenantCountRes = await db.query('SELECT COUNT(*) as count FROM tenants WHERE tenant_id = $1', ['sv-demo']);
        const tenantCount = parseInt(tenantCountRes.rows[0]?.count || '0', 10);
        if (tenantCount === 0) {
            logger.info('init', 'Demo tenant missing, inserting it...');
            await db.query(`
                INSERT INTO tenants (tenant_id, name, plants)
                VALUES ($1, $2, $3)
                ON CONFLICT (tenant_id) DO NOTHING
            `, [
                'sv-demo',
                'SafetyVision Demo',
                JSON.stringify([
                    { name: 'Planta Norte', sectors: ['Producción L1', 'Producción L2', 'Almacén', 'Despacho', 'Mantenimiento'] },
                    { name: 'Planta Sur', sectors: ['Producción', 'Envasado', 'Depósito', 'Laboratorio'] },
                    { name: 'Planta Central', sectors: ['Oficinas', 'Producción', 'Calderas', 'Subestación eléctrica'] },
                    { name: 'Obra Externa', sectors: ['Frente de obra', 'Obrador', 'Acopio'] },
                ])
            ]);
        }

        migrated = true;
    } catch {
        // La tabla no existe o falta algo — correr migración ligera e idempotente
        logger.warn('init', 'Running auto-migration (missing tables or columns detected)');

        // 1. Table: tenants (Base configuration)
        await db.query(`
            CREATE TABLE IF NOT EXISTS tenants (
                tenant_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                plants JSONB NOT NULL DEFAULT '[]',
                settings JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed del tenant demo
        await db.query(`
            INSERT INTO tenants (tenant_id, name, plants)
            VALUES ($1, $2, $3)
            ON CONFLICT (tenant_id) DO NOTHING
        `, [
            'sv-demo',
            'SafetyVision Demo',
            JSON.stringify([
                { name: 'Planta Norte', sectors: ['Producción L1', 'Producción L2', 'Almacén', 'Despacho', 'Mantenimiento'] },
                { name: 'Planta Sur', sectors: ['Producción', 'Envasado', 'Depósito', 'Laboratorio'] },
                { name: 'Planta Central', sectors: ['Oficinas', 'Producción', 'Calderas', 'Subestación eléctrica'] },
                { name: 'Obra Externa', sectors: ['Frente de obra', 'Obrador', 'Acopio'] },
            ])
        ]);

        // 2. Table: users (Auth and signature data)
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                display_name TEXT,
                full_name TEXT,
                license_number TEXT,
                job_title TEXT DEFAULT 'Inspector de Seguridad e Higiene',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migración: campos de firma y empresas asignadas
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS full_name TEXT,
            ADD COLUMN IF NOT EXISTS license_number TEXT,
            ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT 'Inspector de Seguridad e Higiene',
            ADD COLUMN IF NOT EXISTS assigned_companies JSONB DEFAULT '[]';
        `);

        // 3. Table: companies (Managed entities)
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

        // 4. Table: inspections (Inspection headers)
        await db.query(`
            CREATE TABLE IF NOT EXISTS inspections (
                inspection_id UUID PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                user_id UUID REFERENCES users(id),
                plant TEXT NOT NULL,
                sector TEXT,
                state JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migración: añadir company_id a las inspecciones
        await db.query(`
            ALTER TABLE inspections
            ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(company_id);
        `);

        // Migración: FK inspections.user_id -> ON DELETE SET NULL
        await db.query(`
            ALTER TABLE inspections
            DROP CONSTRAINT IF EXISTS inspections_user_id_fkey;
        `);
        await db.query(`
            ALTER TABLE inspections
            ADD CONSTRAINT inspections_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE SET NULL;
        `);

        // 5. Table: photos (Evidence Storage)
        await db.query(`
            CREATE TABLE IF NOT EXISTS photos (
                photo_id UUID PRIMARY KEY,
                inspection_id UUID NOT NULL,
                mime_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 6. Table: audit_trail (Intervention tracking)
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_trail (
                id UUID PRIMARY KEY,
                inspection_id UUID REFERENCES inspections(inspection_id) ON DELETE CASCADE,
                tenant_id TEXT NOT NULL,
                risk_id TEXT NOT NULL,
                action TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT,
                note TEXT,
                inspector_id TEXT NOT NULL,
                inspector_email TEXT NOT NULL,
                inspector_name TEXT NOT NULL,
                seal TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 7. Table: ai_feedback (Analytics)
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

        // 8. Table: schedules (Planned inspections)
        await db.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id UUID PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                company_id UUID REFERENCES companies(company_id),
                inspector_id UUID REFERENCES users(id),
                scheduled_date DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'programada',
                data JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ── Creación de índices ──
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_tenant ON inspections(tenant_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_plant ON inspections(plant);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_photos_inspection ON photos(inspection_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);`);
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_tenant ON companies(tenant_id, name);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspections(company_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_trail_inspection ON audit_trail(inspection_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant ON audit_trail(tenant_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant ON ai_feedback(tenant_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON schedules(tenant_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_schedules_inspector ON schedules(inspector_id);`);

        // Sembrar usuarios de demostración por defecto
        await seedUsers();

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
