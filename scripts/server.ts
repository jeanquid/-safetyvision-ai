import 'dotenv/config';
import express from 'express';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import db from '../api/_db.js';
import { seedUsers } from '../api/_auth/store.js';
import { createApiApp } from '../api/_app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function autoMigrate() {
    console.log('🔄 Running auto-migration...');
    try {
        // Users
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

        // Inspections
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

        // Photos
        await db.query(`
            CREATE TABLE IF NOT EXISTS photos (
                photo_id UUID PRIMARY KEY,
                inspection_id UUID NOT NULL,
                mime_type TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tenants
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

        // Companies
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

        // Add company_id to inspections if missing
        await db.query(`
            ALTER TABLE inspections
            ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(company_id);
        `);

        // Indexes
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_tenant ON inspections(tenant_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_plant ON inspections(plant);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspections(company_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_photos_inspection ON photos(inspection_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);`);
        await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_tenant ON companies(tenant_id, name);`);

        // Seed demo tenant
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
            ])
        ]);

        console.log('✅ Auto-migration complete.');
    } catch (err: any) {
        console.error('❌ Auto-migration failed:', err.message);
    }
}

async function startServer() {
    await autoMigrate();
    await seedUsers();

    const app = express();
    const port = 3000;

    const apiApp = await createApiApp();
    app.use(apiApp);

    const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
        if (req.originalUrl.startsWith('/api')) return next();
        try {
            let template = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
            template = await vite.transformIndexHtml(req.originalUrl, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
            vite.ssrFixStacktrace(e as Error);
            next(e);
        }
    });

    app.listen(port, () => {
        console.log(`> SafetyVision AI ready on http://localhost:${port}`);
    });
}

startServer();
