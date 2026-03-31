import { Request, Response } from 'express';
import { getUserById } from './store.js';

export const meHandler = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser) return res.status(401).json({ ok: false, error: 'Unauthorized' });

        const user = await getUserById(authUser.userId);
        if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

        const { passwordHash, ...safe } = user;
        res.json({ ok: true, user: safe });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Internal Server Error' });
    }
};

export default meHandler;
