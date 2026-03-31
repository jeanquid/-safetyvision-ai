import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail } from './store.js';
import { AuthPayload } from './types.js';

export const loginHandler = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'Email and password required' });
    }

    console.log(`[AUTH] Login attempt for: "${email}"`);
    const user = await getUserByEmail(email);
    if (!user) {
        console.log(`[AUTH] User NOT found: "${email}"`);
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const payload: AuthPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        displayName: user.displayName
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ ok: false, error: 'Server configuration error' });
    }
    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    const { passwordHash, ...userWithoutPassword } = user;
    res.json({ ok: true, token, user: userWithoutPassword });
};

export default loginHandler;
