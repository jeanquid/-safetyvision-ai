import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/safetyvision';

console.log(`[DB] Using connection: ${connectionString.split('@')[1] || 'default'}`);

export const db = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase.co') || connectionString.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : false
});

export default db;
