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
