import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from './types.js';

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    jwt.verify(token, secret, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = decoded as AuthPayload;
        next();
    });
};

export const withAuth = (handler: any) => async (req: any, res: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const decoded = jwt.verify(token, secret) as AuthPayload;
        req.user = decoded;
        return handler(req, res);
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
