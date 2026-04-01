import 'dotenv/config';
import db from '../api/_db.js';
import { createTenant } from '../api/_tenant.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const args = process.argv.slice(2);

if (args.length < 4) {
    console.log(`
Uso: npx tsx scripts/onboard-tenant.ts <tenant_id> <nombre_empresa> <admin_email> <admin_password>

Ejemplo:
  npx tsx scripts/onboard-tenant.ts acme-sa "ACME Argentina SA" admin@acme.com MiPassword123

Opcionalmente, agregar plantas:
  npx tsx scripts/onboard-tenant.ts acme-sa "ACME Argentina SA" admin@acme.com MiPassword123 \\
    "Planta Pacheco:Producción,Almacén,Despacho" \\
    "Planta Tigre:Envasado,Laboratorio"
`);
    process.exit(1);
}

const [tenantId, tenantName, adminEmail, adminPassword, ...plantArgs] = args;

async function onboard() {
    try {
        console.log(`\n🏭 Onboarding: ${tenantName} (${tenantId})`);

        // Parsear plantas si se proporcionaron
        const plants = plantArgs.length > 0
            ? plantArgs.map(arg => {
                const [name, sectorsStr] = arg.split(':');
                return { name: name.trim(), sectors: (sectorsStr || 'General').split(',').map(s => s.trim()) };
            })
            : [{ name: 'Planta Principal', sectors: ['General'] }];

        // Crear tenant
        console.log(`📋 Creando tenant con ${plants.length} planta(s)...`);
        await createTenant(tenantId, tenantName, plants);

        // Crear admin
        console.log(`👤 Creando admin: ${adminEmail}...`);
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await db.query(`
            INSERT INTO users (id, email, password_hash, role, tenant_id, display_name)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [uuidv4(), adminEmail.toLowerCase(), passwordHash, 'admin', tenantId, 'Administrador']);

        console.log(`\n✅ Tenant "${tenantName}" creado exitosamente!`);
        console.log(`   Admin: ${adminEmail}`);
        console.log(`   Plantas: ${plants.map(p => p.name).join(', ')}`);
        console.log(`\n   El admin puede loguearse y desde el panel crear más usuarios y configurar plantas.`);
    } catch (error: any) {
        if (error.message?.includes('duplicate key')) {
            console.error(`\n❌ El tenant "${tenantId}" o el email "${adminEmail}" ya existe.`);
        } else {
            console.error(`\n❌ Error:`, error.message);
        }
    } finally {
        await db.end();
    }
}

onboard();
