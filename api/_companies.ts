import db from './_db.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';
import { Company, CompanyStats } from './_types.js';

export async function createCompany(data: {
    tenantId: string;
    name: string;
    rut?: string;
    address?: string;
    contactName?: string;
    contactPhone?: string;
    plants?: { name: string; sectors: string[] }[];
    notes?: string;
}): Promise<Company> {
    const companyId = uuidv4();
    const now = new Date().toISOString();
    const plants = data.plants || [{ name: 'Planta Principal', sectors: ['General'] }];

    await db.query(`
        INSERT INTO companies (company_id, tenant_id, name, rut, address, contact_name, contact_phone, plants, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [companyId, data.tenantId, data.name, data.rut || null, data.address || null,
        data.contactName || null, data.contactPhone || null, JSON.stringify(plants), data.notes || null]);

    logger.info('companies', 'Company created', { companyId, name: data.name });

    return {
        companyId, tenantId: data.tenantId, name: data.name,
        rut: data.rut, address: data.address,
        contactName: data.contactName, contactPhone: data.contactPhone,
        plants, notes: data.notes, status: 'active',
        createdAt: now, updatedAt: now,
    };
}

export async function listCompanies(tenantId: string): Promise<Company[]> {
    const result = await db.query(`
        SELECT * FROM companies
        WHERE tenant_id = $1 AND status = 'active'
        ORDER BY name ASC
    `, [tenantId]);

    return result.rows.map(row => ({
        companyId: row.company_id,
        tenantId: row.tenant_id,
        name: row.name,
        rut: row.rut,
        address: row.address,
        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        plants: row.plants || [],
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}

export async function getCompany(companyId: string): Promise<Company | null> {
    const result = await db.query('SELECT * FROM companies WHERE company_id = $1', [companyId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        companyId: row.company_id, tenantId: row.tenant_id, name: row.name,
        rut: row.rut, address: row.address,
        contactName: row.contact_name, contactPhone: row.contact_phone,
        plants: row.plants || [], notes: row.notes, status: row.status,
        createdAt: row.created_at, updatedAt: row.updated_at,
    };
}

export async function updateCompany(companyId: string, data: Partial<{
    name: string; rut: string; address: string;
    contactName: string; contactPhone: string;
    plants: { name: string; sectors: string[] }[];
    notes: string;
}>): Promise<boolean> {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name) { sets.push(`name = $${idx++}`); values.push(data.name); }
    if (data.rut !== undefined) { sets.push(`rut = $${idx++}`); values.push(data.rut); }
    if (data.address !== undefined) { sets.push(`address = $${idx++}`); values.push(data.address); }
    if (data.contactName !== undefined) { sets.push(`contact_name = $${idx++}`); values.push(data.contactName); }
    if (data.contactPhone !== undefined) { sets.push(`contact_phone = $${idx++}`); values.push(data.contactPhone); }
    if (data.plants) { sets.push(`plants = $${idx++}`); values.push(JSON.stringify(data.plants)); }
    if (data.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(data.notes); }

    if (sets.length === 0) return false;

    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(companyId);

    const result = await db.query(
        `UPDATE companies SET ${sets.join(', ')} WHERE company_id = $${idx}`,
        values
    );
    logger.info('companies', 'Company updated', { companyId });
    return (result.rowCount || 0) > 0;
}

export async function deleteCompany(companyId: string): Promise<void> {
    // Soft delete — marcar como archived
    await db.query(
        `UPDATE companies SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE company_id = $1`,
        [companyId]
    );
    logger.info('companies', 'Company archived', { companyId });
}

export async function getCompaniesWithStats(tenantId: string, userCtx?: any): Promise<CompanyStats[]> {
    let assignedFilter = '';
    const queryParams: any[] = [tenantId];

    if (userCtx && userCtx.role !== 'admin') {
        // Fetch user from DB to get assigned_companies (it might not be in JWT)
        const uRes = await db.query('SELECT assigned_companies FROM users WHERE id = $1', [userCtx.userId]);
        const assignedCompanies = uRes.rows[0]?.assigned_companies || [];
        
        if (assignedCompanies.length === 0) {
            return [];
        }

        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUuids = assignedCompanies.filter((c: any) => typeof c === 'string' && UUID_RE.test(c));

        if (validUuids.length === 0) return [];

        assignedFilter = ` AND c.company_id = ANY($2::uuid[]) `;
        queryParams.push(validUuids);
    }

    const result = await db.query(`
        SELECT
            c.company_id,
            c.name,
            COUNT(i.inspection_id) AS total_inspections,
            COALESCE(SUM(jsonb_array_length(i.state->'risks')), 0) AS total_risks,
            COALESCE(SUM(
                (SELECT COUNT(*) FROM jsonb_array_elements(i.state->'risks') r WHERE r->>'level' = 'alto')
            ), 0) AS high_risks,
            COUNT(*) FILTER (WHERE i.state->'task'->>'status' = 'pendiente') AS pending_tasks,
            COUNT(*) FILTER (WHERE i.state->'task'->>'status' = 'resuelto') AS resolved_tasks,
            MAX(i.created_at) AS last_inspection_date
        FROM companies c
        LEFT JOIN inspections i ON i.company_id = c.company_id
        WHERE c.tenant_id = $1 AND c.status = 'active' ${assignedFilter}
        GROUP BY c.company_id, c.name
        ORDER BY c.name ASC
    `, queryParams);

    return result.rows.map(row => {
        const total = parseInt(row.total_inspections) || 1;
        const resolved = parseInt(row.resolved_tasks) || 0;
        return {
            companyId: row.company_id,
            name: row.name,
            totalInspections: parseInt(row.total_inspections) || 0,
            totalRisks: parseInt(row.total_risks) || 0,
            highRisks: parseInt(row.high_risks) || 0,
            pendingTasks: parseInt(row.pending_tasks) || 0,
            resolvedPct: parseInt(row.total_inspections) > 0
                ? Math.round((resolved / total) * 100) : 0,
            lastInspectionDate: row.last_inspection_date || null,
        };
    });
}

// Borrar TODAS las inspecciones de una empresa (reset)
export async function resetCompanyInspections(companyId: string): Promise<number> {
    // Primero borrar fotos asociadas
    await db.query(`
        DELETE FROM photos WHERE inspection_id IN (
            SELECT inspection_id FROM inspections WHERE company_id = $1
        )
    `, [companyId]);

    const result = await db.query(
        'DELETE FROM inspections WHERE company_id = $1',
        [companyId]
    );

    const deleted = result.rowCount || 0;
    logger.info('companies', 'Company inspections reset', { companyId, deletedCount: deleted });
    return deleted;
}
