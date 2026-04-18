import db from './_db.js';
import { seedUsers } from './_auth/store.js';

async function migrate() {
    console.log('🚀 Starting SafetyVision Database Migration...');

    try {
        console.log('--- Creating table: users ---');
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                display_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table "users" OK.');

        console.log('--- Adding signature fields to users ---');
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS full_name TEXT,
            ADD COLUMN IF NOT EXISTS license_number TEXT,
            ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT 'Inspector de Seguridad e Higiene';
        `);
        console.log('✅ Signature fields added to users.');

        console.log('--- Creating table: inspections ---');
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
        console.log('✅ Table "inspections" OK.');

        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_tenant ON inspections(tenant_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_plant ON inspections(plant);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        console.log('✅ Indexes OK.');

        console.log('--- Creating table: photos ---');
        await db.query(`
            CREATE TABLE IF NOT EXISTS photos (
                photo_id UUID PRIMARY KEY,
                inspection_id UUID NOT NULL,
                mime_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(
            `CREATE INDEX IF NOT EXISTS idx_photos_inspection ON photos(inspection_id);`
        );
        console.log('✅ Table "photos" OK.');

        console.log('--- Creating table: tenants ---');
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
        console.log('✅ Table "tenants" OK.');

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
        console.log('✅ Tenant "sv-demo" seeded.');

        console.log('--- Creating table: companies ---');
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
        await db.query(`CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);`);
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_tenant ON companies(tenant_id, name);`);
        console.log('✅ Table "companies" OK.');

        console.log('--- Adding company_id to inspections ---');
        await db.query(`
            ALTER TABLE inspections
            ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(company_id);
        `);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspections(company_id);`);
        console.log('✅ Column "company_id" added to inspections.');

        console.log('--- Fixing FK: inspections.user_id → ON DELETE SET NULL ---');
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
        console.log('✅ FK inspections_user_id_fkey updated.');

        console.log('--- Creating table: ai_feedback ---');
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
        console.log('✅ Table "ai_feedback" OK.');

        await seedUsers();
        console.log('🎉 Migration completed!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.end();
    }
}

migrate();
