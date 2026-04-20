import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../_db.js';

// GET /api/users — listar usuarios del tenant
export const listUsersHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const result = await db.query(
            `SELECT id, email, role, display_name, full_name, license_number, job_title, assigned_companies, created_at
             FROM users WHERE tenant_id = $1
             ORDER BY created_at DESC`,
            [user.tenantId]
        );

        res.json({ ok: true, users: result.rows });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/users — crear usuario
export const createUserHandler = async (req: Request, res: Response) => {
    try {
        const adminUser = (req as any).user;
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { email, password, role, displayName, fullName, licenseNumber, jobTitle } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        if (!['admin', 'inspector', 'supervisor'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Verificar que no exista
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const id = uuidv4();

        await db.query(`
            INSERT INTO users (id, email, password_hash, role, tenant_id, display_name, full_name, license_number, job_title)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            id,
            email.toLowerCase(),
            passwordHash,
            role,
            adminUser.tenantId,
            displayName || email.split('@')[0],
            fullName || null,
            licenseNumber || null,
            jobTitle || 'Inspector de Seguridad e Higiene',
        ]);

        res.json({ ok: true, user: { id, email, role, displayName, fullName, licenseNumber, jobTitle } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/users/:id — eliminar usuario
export const deleteUserHandler = async (req: Request, res: Response) => {
    try {
        const adminUser = (req as any).user;
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        // No permitir auto-borrado
        if (req.params.id === adminUser.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        // Verificar que sea del mismo tenant
        const target = await db.query(
            'SELECT tenant_id FROM users WHERE id = $1',
            [req.params.id]
        );
        if (target.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (target.rows[0].tenant_id !== adminUser.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/users/:id — actualizar usuario (asignar empresas)
export const updateUserHandler = async (req: Request, res: Response) => {
    try {
        const adminUser = (req as any).user;
        if (adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { assigned_companies } = req.body;
        if (!Array.isArray(assigned_companies)) {
            return res.status(400).json({ error: 'assigned_companies must be an array' });
        }

        const target = await db.query(
            'SELECT tenant_id FROM users WHERE id = $1',
            [req.params.id]
        );
        if (target.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (target.rows[0].tenant_id !== adminUser.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.query(
            'UPDATE users SET assigned_companies = $1 WHERE id = $2',
            [JSON.stringify(assigned_companies), req.params.id]
        );

        res.json({ ok: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
