import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';
import { logger } from './_logger.js';

const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/safetyvision';

logger.info('db', 'Connecting', { host: connectionString.split('@')[1]?.split('/')[0] || 'default' });

export const db = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase.co') || connectionString.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : false
});

export default db;
