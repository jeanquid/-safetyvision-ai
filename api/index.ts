import { createApiApp } from './_app.js';

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
    try {
        if (!cachedApp) {
            cachedApp = await createApiApp();
            console.log('✅ SafetyVision API instance created/cached');
        }
        return cachedApp(req, res);
    } catch (error: any) {
        console.error('[CRITICAL] API Crash:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server crash', message: error.message });
        }
    }
}
