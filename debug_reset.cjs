const pkg = require('pg');
const bcrypt = require('bcryptjs');
const { Pool } = pkg;

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
    console.error('POSTGRES_URL is missing');
    process.exit(1);
}

const db = new Pool({ 
    connectionString, 
    ssl: { rejectUnauthorized: false } 
});

async function reset() {
    try {
        console.log('--- EMERGENCY ADMIN RESET ---');
        console.log('Clearing existing admin...');
        await db.query('DELETE FROM users WHERE email = $1', ['admin@safetyvision.ai']);
        
        console.log('Hashing password "seguridad1"...');
        const hash = await bcrypt.hash('seguridad1', 10);
        
        console.log('Inserting fresh admin user...');
        await db.query(`
            INSERT INTO users (id, email, password_hash, role, tenant_id, display_name) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `, ['00000000-0000-0000-0000-000000000001', 'admin@safetyvision.ai', hash, 'admin', 'sv-demo', 'Administrador']);
        
        console.log('✅ Admin reset SUCCESS!');
        console.log('Credentials: admin@safetyvision.ai / seguridad1');
    } catch(e) {
        console.error('❌ Reset failed:', e.message);
    } finally {
        await db.end();
    }
}

reset();
