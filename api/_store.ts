import { InspectionState, DetectedRisk, CorrectiveTask } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import db from './_db.js';

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
        console.log(`✅ [Store] Inspection ${inspectionId} created`);
    } catch (error) {
        console.error(`❌ [Store] Failed to create inspection:`, error);
        throw error;
    }

    return state;
}

export async function getInspection(inspectionId: string): Promise<InspectionState | null> {
    try {
        const result = await db.query('SELECT state FROM inspections WHERE inspection_id = $1', [inspectionId]);
        if (result.rows.length === 0) return null;
        return result.rows[0].state as InspectionState;
    } catch (error) {
        console.error(`❌ [Store] Error fetching inspection ${inspectionId}:`, error);
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
        console.log(`✅ [Store] Inspection ${inspectionId} updated`);
    } catch (error) {
        console.error(`❌ [Store] Failed to update inspection:`, error);
        throw error;
    }
    return ins;
}

export async function listInspections(tenantId: string, filters?: {
    plant?: string;
    status?: string;
    level?: string;
    limit?: number;
}): Promise<InspectionState[]> {
    try {
        let query = 'SELECT state FROM inspections WHERE tenant_id = $1 ORDER BY created_at DESC';
        const values: any[] = [tenantId];

        if (filters?.limit) {
            query += ` LIMIT $2`;
            values.push(filters.limit);
        }

        const result = await db.query(query, values);
        let inspections = result.rows.map(r => r.state as InspectionState);

        // In-memory filters on JSONB state
        if (filters?.plant) {
            inspections = inspections.filter(i => i.plant === filters.plant);
        }
        if (filters?.status) {
            inspections = inspections.filter(i => i.task.status === filters.status);
        }
        if (filters?.level) {
            inspections = inspections.filter(i =>
                i.risks.some(r => r.level === filters.level)
            );
        }

        return inspections;
    } catch (error) {
        console.error(`❌ [Store] Failed to list inspections:`, error);
        return [];
    }
}

export async function deleteInspection(inspectionId: string): Promise<void> {
    try {
        await db.query('DELETE FROM inspections WHERE inspection_id = $1', [inspectionId]);
        console.log(`🗑️  [Store] Inspection ${inspectionId} deleted`);
    } catch (error) {
        console.error(`❌ [Store] Failed to delete inspection:`, error);
        throw error;
    }
}

export async function getDashboardStats(tenantId: string): Promise<any> {
    const inspections = await listInspections(tenantId);

    const totalRisks = inspections.reduce((s, i) => s + i.risks.length, 0);
    const highRisks = inspections.reduce((s, i) => s + i.risks.filter(r => r.level === 'alto').length, 0);
    const pending = inspections.filter(i => i.task.status === 'pendiente').length;
    const resolved = inspections.filter(i => i.task.status === 'resuelto').length;
    const total = inspections.length || 1;

    const byCategory: Record<string, number> = { epp: 0, condiciones: 0, comportamiento: 0 };
    const byLevel: Record<string, number> = { alto: 0, medio: 0, bajo: 0 };
    const byPlant: Record<string, number> = {};
    const bySector: Record<string, number> = {};

    inspections.forEach(ins => {
        byPlant[ins.plant] = (byPlant[ins.plant] || 0) + ins.risks.length;
        bySector[ins.sector] = (bySector[ins.sector] || 0) + ins.risks.length;
        ins.risks.forEach(r => {
            byCategory[r.category] = (byCategory[r.category] || 0) + 1;
            byLevel[r.level] = (byLevel[r.level] || 0) + 1;
        });
    });

    return {
        totalInspections: inspections.length,
        totalRisks,
        highRisks,
        pendingTasks: pending,
        resolvedPct: Math.round((resolved / total) * 100),
        byCategory,
        byLevel,
        byPlant,
        bySector: Object.entries(bySector).sort((a, b) => b[1] - a[1]),
        recentInspections: inspections.slice(0, 10),
    };
}
