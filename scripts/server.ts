import 'dotenv/config';
import express from 'express';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { seedUsers } from './api/_auth/store';
import { createApiApp } from './api/_app';

console.log('> Environment Check:');
console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'MISSING'}`);
console.log(`  POSTGRES_URL: ${process.env.POSTGRES_URL ? 'CONFIGURED' : 'MISSING'}`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
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
