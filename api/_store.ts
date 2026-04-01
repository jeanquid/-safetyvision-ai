import { InspectionState, DetectedRisk, CorrectiveTask } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import db from './_db.js';
import { logger } from './_logger.js';

export async function createInspection(data: {
    tenantId: string;
    userId: string;
    plant: string;
    sector: string;
    operator: string;
    risks: DetectedRisk[];
    task: CorrectiveTask;
    aiAnalysis?: any;
    photoUrl?: string;
}): Promise<InspectionState> {
    const inspectionId = uuidv4();
    const now = new Date().toISOString();

    const state: InspectionState = {
        inspectionId,
        tenantId: data.tenantId,
        userId: data.userId,
        status: 'pending_review',
        plant: data.plant,
        sector: data.sector,
        operator: data.operator,
        photoUrl: data.photoUrl,
        risks: data.risks,
        task: data.task,
        aiAnalysis: data.aiAnalysis,
        createdAt: now,
        updatedAt: now,
    };

    try {
        await db.query(`
            INSERT INTO inspections (inspection_id, tenant_id, user_id, plant, sector, state)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [inspectionId, data.tenantId, data.userId, data.plant, data.sector, JSON.stringify(state)]);
        logger.info('store', 'Inspection created', { inspectionId, plant: data.plant });
    } catch (error: any) {
        logger.error('store', 'Failed to create inspection', { error: error.message });
        throw error;
    }

    return state;
}

export async function getInspection(inspectionId: string): Promise<InspectionState | null> {
    try {
        const result = await db.query('SELECT state FROM inspections WHERE inspection_id = $1', [inspectionId]);
        if (result.rows.length === 0) return null;
        return result.rows[0].state as InspectionState;
    } catch (error: any) {
        logger.error('store', 'Error fetching inspection', { inspectionId, error: error.message });
        return null;
    }
}

export async function updateInspection(
    inspectionId: string,
    updater: (ins: InspectionState) => void
): Promise<InspectionState> {
    const ins = await getInspection(inspectionId);
    if (!ins) throw new Error(`Inspection ${inspectionId} not found`);

    updater(ins);
    ins.updatedAt = new Date().toISOString();

    try {
        await db.query(`
            UPDATE inspections SET state = $1, updated_at = CURRENT_TIMESTAMP
            WHERE inspection_id = $2
        `, [JSON.stringify(ins), inspectionId]);
        logger.info('store', 'Inspection updated', { inspectionId });
    } catch (error: any) {
        logger.error('store', 'Failed to update inspection', { inspectionId, error: error.message });
        throw error;
    }
    return ins;
}

export async function listInspections(tenantId: string, filters?: {
    plant?: string;
    status?: string;
    level?: string;
    limit?: number;
    offset?: number;
}): Promise<{ inspections: InspectionState[]; total: number }> {
    try {
        const conditions: string[] = ['tenant_id = $1'];
        const values: any[] = [tenantId];
        let paramIndex = 2;

        if (filters?.plant) {
            conditions.push(`plant = $${paramIndex++}`);
            values.push(filters.plant);
        }
        if (filters?.status) {
            conditions.push(`state->'task'->>'status' = $${paramIndex++}`);
            values.push(filters.status);
        }
        if (filters?.level) {
            conditions.push(`EXISTS (
                SELECT 1 FROM jsonb_array_elements(state->'risks') AS r
                WHERE r->>'level' = $${paramIndex++}
            )`);
            values.push(filters.level);
        }

        const whereClause = conditions.join(' AND ');

        const countResult = await db.query(
            `SELECT COUNT(*) FROM inspections WHERE ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count);

        const limit = Math.min(filters?.limit || 50, 100);
        const offset = filters?.offset || 0;

        const result = await db.query(
            `SELECT state FROM inspections
             WHERE ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...values, limit, offset]
        );

        return {
            inspections: result.rows.map(r => r.state as InspectionState),
            total,
        };
    } catch (error: any) {
        logger.error('store', 'Failed to list inspections', { tenantId, error: error.message });
        return { inspections: [], total: 0 };
    }
}

export async function deleteInspection(inspectionId: string): Promise<void> {
    try {
        await db.query('DELETE FROM inspections WHERE inspection_id = $1', [inspectionId]);
        logger.info('store', 'Inspection deleted', { inspectionId });
    } catch (error: any) {
        logger.error('store', 'Failed to delete inspection', { inspectionId, error: error.message });
        throw error;
    }
}

export async function getDashboardStats(tenantId: string): Promise<any> {
    try {
        const statsQuery = await db.query(`
            SELECT
                COUNT(*) AS total_inspections,
                COUNT(*) FILTER (WHERE state->'task'->>'status' = 'pendiente') AS pending,
                COUNT(*) FILTER (WHERE state->'task'->>'status' = 'resuelto') AS resolved
            FROM inspections
            WHERE tenant_id = $1
        `, [tenantId]);

        const { total_inspections, pending, resolved } = statsQuery.rows[0];
        const total = parseInt(total_inspections) || 1;

        const risksQuery = await db.query(`
            SELECT
                r->>'level' AS level,
                r->>'category' AS category,
                COUNT(*) AS count
            FROM inspections,
                 jsonb_array_elements(state->'risks') AS r
            WHERE tenant_id = $1
            GROUP BY r->>'level', r->>'category'
        `, [tenantId]);

        const byCategory: Record<string, number> = { epp: 0, condiciones: 0, comportamiento: 0 };
        const byLevel: Record<string, number> = { alto: 0, medio: 0, bajo: 0 };
        let totalRisks = 0;
        let highRisks = 0;

        for (const row of risksQuery.rows) {
            const count = parseInt(row.count);
            totalRisks += count;
            if (row.level) byLevel[row.level] = (byLevel[row.level] || 0) + count;
            if (row.category) byCategory[row.category] = (byCategory[row.category] || 0) + count;
            if (row.level === 'alto') highRisks += count;
        }

        const sectorQuery = await db.query(`
            SELECT
                sector,
                SUM(jsonb_array_length(state->'risks')) AS risk_count
            FROM inspections
            WHERE tenant_id = $1
            GROUP BY sector
            ORDER BY risk_count DESC
            LIMIT 5
        `, [tenantId]);

        const recentQuery = await db.query(`
            SELECT state FROM inspections
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [tenantId]);

        return {
            totalInspections: parseInt(total_inspections),
            totalRisks,
            highRisks,
            pendingTasks: parseInt(pending),
            resolvedPct: Math.round((parseInt(resolved) / total) * 100),
            byCategory,
            byLevel,
            bySector: sectorQuery.rows.map(r => [r.sector, parseInt(r.risk_count)]),
            recentInspections: recentQuery.rows.map(r => r.state),
        };
    } catch (error: any) {
        logger.error('store', 'Dashboard stats failed', { tenantId, error: error.message });
        return {
            totalInspections: 0, totalRisks: 0, highRisks: 0,
            pendingTasks: 0, resolvedPct: 0,
            byCategory: {}, byLevel: {}, bySector: [],
            recentInspections: [],
        };
    }
}
