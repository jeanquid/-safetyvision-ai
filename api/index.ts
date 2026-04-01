import { createApiApp } from './_app.js';
import { logger } from './_logger.js';

logger.info('init', 'SafetyVision API initializing');

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
    try {
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
