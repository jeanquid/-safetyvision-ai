import { User } from './types.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../_db.js';

export async function getUserByEmail(email: string): Promise<User | null> {
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            tenantId: row.tenant_id,
            displayName: row.display_name || row.email.split('@')[0],
            createdAt: row.created_at
        };
    } catch (error) {
        console.error('Error getting user by email:', error);
        return null;
    }
}

export async function getUserById(id: string): Promise<User | null> {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            tenantId: row.tenant_id,
            displayName: row.display_name || row.email.split('@')[0],
            createdAt: row.created_at
        };
    } catch (error) {
        console.error('Error getting user by id:', error);
        return null;
    }
}

export async function seedUsers() {
    console.log('🌱 Seeding/Updating demo users in database...');

    const usersToSeed = [
        {
            email: process.env.SEED_ADMIN_EMAIL || 'admin@safetyvision.ai',
            password: process.env.SEED_ADMIN_PASSWORD,
            role: 'admin' as const,
            tenantId: 'sv-demo',
            displayName: 'Administrador'
        },
        {
            email: process.env.SEED_INSPECTOR_EMAIL || 'inspector@safetyvision.ai',
            password: process.env.SEED_INSPECTOR_PASSWORD,
            role: 'inspector' as const,
            tenantId: 'sv-demo',
            displayName: 'Inspector de Seguridad'
        }
    ].filter(u => !!u.password);

    for (const u of usersToSeed) {
        try {
            const existing = await getUserByEmail(u.email);
            if (!existing) {
                const passwordHash = await bcrypt.hash(u.password!, 10);
                await db.query(`
                    INSERT INTO users (id, email, password_hash, role, tenant_id, display_name)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [uuidv4(), u.email, passwordHash, u.role, u.tenantId, u.displayName]);
                console.log(`✅ User ${u.email} seeded.`);
            } else {
                console.log(`ℹ️  User ${u.email} already exists — skipping.`);
            }
        } catch (error) {
            console.error(`❌ Failed to seed user ${u.email}:`, error);
        }
    }
}
