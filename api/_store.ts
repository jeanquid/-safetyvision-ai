import { InspectionState, DetectedRisk, CorrectiveTask, AuditEntry, deriveInspectionStatus, deriveTaskStatus } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import db from './_db.js';
import { logger } from './_logger.js';

/**
 * Genera un sello (hash) para una entrada de audit trail.
 * Usa SHA-256 con los campos clave + hash anterior para formar cadena.
 */
async function generateSeal(entry: Omit<AuditEntry, 'seal'>, previousSeal: string): Promise<string> {
    const payload = `${entry.inspectorId}|${entry.action}|${entry.riskId}|${entry.timestamp}|${previousSeal}`;
    const { createHash } = await import('crypto');
    return createHash('sha256').update(payload).digest('hex').substring(0, 16);
}

export async function createInspection(data: {
    tenantId: string;
    userId: string;
    companyId: string;
    companyName?: string;
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

    const risksWithHistory = data.risks.map(r => ({
        ...r,
        status: r.status || 'pendiente' as const,
        history: r.history || [],
        updatedBy: data.userId,
        updatedAt: now,
    }));

    const state: InspectionState = {
        inspectionId,
        tenantId: data.tenantId,
        userId: data.userId,
        companyId: data.companyId,
        companyName: data.companyName,
        status: deriveInspectionStatus(risksWithHistory),
        plant: data.plant,
        sector: data.sector,
        operator: data.operator,
        photoUrl: data.photoUrl,
        risks: risksWithHistory,
        task: {
            ...data.task,
            status: deriveTaskStatus(risksWithHistory),
        },
        auditTrail: [],
        aiAnalysis: data.aiAnalysis,
        createdAt: now,
        updatedAt: now,
    };

    try {
        await db.query(`
            INSERT INTO inspections (inspection_id, tenant_id, user_id, company_id, plant, sector, state)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [inspectionId, data.tenantId, data.userId, data.companyId, data.plant, data.sector, JSON.stringify(state)]);
        logger.info('store', 'Inspection created', { inspectionId, companyId: data.companyId, plant: data.plant });
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
        const state = result.rows[0].state as InspectionState;
        // Migración en caliente: asegurar que auditTrail y history existan
        if (!state.auditTrail) state.auditTrail = [];
        state.risks = (state.risks || []).map(r => ({
            ...r,
            history: r.history || [],
            status: r.status || 'pendiente',
        }));
        return state;
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

    // Recalcular status derivado después de cualquier cambio
    ins.status = deriveInspectionStatus(ins.risks);
    ins.task.status = deriveTaskStatus(ins.risks);

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

/**
 * Actualiza el status de un riesgo individual y registra la intervención sellada.
 */
export async function updateRiskStatus(
    inspectionId: string,
    riskId: string,
    newStatus: string,
    user: { userId: string; email: string; displayName?: string },
    note?: string
): Promise<InspectionState> {
    const ins = await getInspection(inspectionId);
    if (!ins) throw new Error(`Inspection ${inspectionId} not found`);

    const risk = ins.risks.find(r => r.id === riskId);
    if (!risk) throw new Error(`Risk ${riskId} not found in inspection ${inspectionId}`);

    const oldStatus = risk.status;
    if (oldStatus === newStatus) return ins;

    const now = new Date().toISOString();

    const lastSeal = ins.auditTrail.length > 0
        ? ins.auditTrail[ins.auditTrail.length - 1].seal
        : '0000000000000000';

    const auditEntry: Omit<AuditEntry, 'seal'> = {
        id: uuidv4(),
        riskId,
        action: 'status_change',
        fromStatus: oldStatus as any,
        toStatus: newStatus as any,
        note,
        inspectorId: user.userId,
        inspectorEmail: user.email,
        inspectorName: user.displayName || user.email,
        timestamp: now,
    };

    const seal = await generateSeal(auditEntry, lastSeal);
    const sealedEntry: AuditEntry = { ...auditEntry, seal };

    risk.status = newStatus as any;
    risk.updatedBy = user.email;
    risk.updatedAt = now;
    if (!risk.history) risk.history = [];
    risk.history.push(sealedEntry);

    if (!ins.auditTrail) ins.auditTrail = [];
    ins.auditTrail.push(sealedEntry);

    ins.status = deriveInspectionStatus(ins.risks);
    ins.task.status = deriveTaskStatus(ins.risks);

    if (ins.task.status === 'resuelto' && !ins.task.resolvedAt) {
        ins.task.resolvedAt = now;
        ins.task.resolvedBy = user.email;
    }

    ins.updatedAt = now;

    try {
        await db.query(`
            UPDATE inspections SET state = $1, updated_at = CURRENT_TIMESTAMP
            WHERE inspection_id = $2
        `, [JSON.stringify(ins), inspectionId]);

        await db.query(`
            INSERT INTO audit_trail (id, inspection_id, tenant_id, risk_id, action, from_status, to_status, note, inspector_id, inspector_email, inspector_name, seal, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
            sealedEntry.id, inspectionId, ins.tenantId, riskId,
            sealedEntry.action, oldStatus, newStatus, note || null,
            user.userId, user.email, user.displayName || user.email,
            seal, now
        ]);

        logger.info('store', 'Risk status updated', { inspectionId, riskId, from: oldStatus, to: newStatus, by: user.email });
    } catch (error: any) {
        logger.error('store', 'Failed to update risk status', { inspectionId, riskId, error: error.message });
        throw error;
    }

    return ins;
}

export async function listInspections(tenantId: string, filters?: {
    companyId?: string;
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

        if (filters?.companyId) {
            conditions.push(`(company_id::text = $${paramIndex} OR state->>'companyId' = $${paramIndex})`);
            values.push(filters.companyId);
            paramIndex++;
        }

        if (filters?.plant) {
            conditions.push(`plant = $${paramIndex++}`);
            values.push(filters.plant);
        }
        if (filters?.status) {
            if (filters.status === 'resuelto') {
                conditions.push(`state->>'status' = 'closed'`);
            } else if (filters.status === 'en_progreso') {
                conditions.push(`state->>'status' = 'active'`);
            } else if (filters.status === 'pendiente') {
                conditions.push(`state->>'status' IN ('pending_review', 'analyzing')`);
            }
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

        const inspections = result.rows.map(r => {
            const state = r.state as InspectionState;
            if (!state.auditTrail) state.auditTrail = [];
            state.risks = (state.risks || []).map(risk => ({
                ...risk,
                history: risk.history || [],
                status: risk.status || 'pendiente',
            }));
            return state;
        });

        return { inspections, total };
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

export async function getDashboardStats(tenantId: string, companyId?: string): Promise<any> {
    try {
        const companyFilter = companyId ? ` AND (company_id::text = $2 OR state->>'companyId' = $2)` : '';
        const params = companyId ? [tenantId, companyId] : [tenantId];

        const statsQuery = await db.query(`
            SELECT
                COUNT(*) AS total_inspections,
                COUNT(*) FILTER (WHERE state->>'status' IN ('pending_review', 'analyzing')) AS pending,
                COUNT(*) FILTER (WHERE state->>'status' = 'closed') AS resolved
            FROM inspections
            WHERE tenant_id = $1${companyFilter}
        `, params);

        const { total_inspections, pending, resolved } = statsQuery.rows[0];
        const total = parseInt(total_inspections) || 1;

        const risksQuery = await db.query(`
            SELECT
                r->>'level' AS level,
                r->>'category' AS category,
                r->>'status' AS risk_status,
                COUNT(*) AS count
            FROM inspections,
                 jsonb_array_elements(state->'risks') AS r
            WHERE tenant_id = $1${companyFilter}
            GROUP BY r->>'level', r->>'category', r->>'status'
        `, params);

        const byCategory: Record<string, number> = { epp: 0, condiciones: 0, comportamiento: 0 };
        const byLevel: Record<string, number> = { alto: 0, medio: 0, bajo: 0 };
        const byRiskStatus: Record<string, number> = { pendiente: 0, en_progreso: 0, resuelto: 0 };
        let totalRisks = 0;
        let highRisks = 0;

        for (const row of risksQuery.rows) {
            const count = parseInt(row.count);
            totalRisks += count;
            if (row.level) byLevel[row.level] = (byLevel[row.level] || 0) + count;
            if (row.category) byCategory[row.category] = (byCategory[row.category] || 0) + count;
            if (row.risk_status) byRiskStatus[row.risk_status] = (byRiskStatus[row.risk_status] || 0) + count;
            if (row.level === 'alto') highRisks += count;
        }

        const sectorQuery = await db.query(`
            SELECT
                sector,
                SUM(jsonb_array_length(state->'risks')) AS risk_count
            FROM inspections
            WHERE tenant_id = $1${companyFilter}
            GROUP BY sector
            ORDER BY risk_count DESC
            LIMIT 5
        `, params);

        const recentQuery = await db.query(`
            SELECT state FROM inspections
            WHERE tenant_id = $1${companyFilter}
            ORDER BY created_at DESC
            LIMIT 10
        `, params);

        return {
            totalInspections: parseInt(total_inspections),
            totalRisks,
            highRisks,
            pendingTasks: parseInt(pending),
            resolvedPct: Math.round((parseInt(resolved) / total) * 100),
            byCategory,
            byLevel,
            byRiskStatus,
            bySector: sectorQuery.rows.map(r => [r.sector, parseInt(r.risk_count)]),
            recentInspections: recentQuery.rows.map(r => r.state),
        };
    } catch (error: any) {
        logger.error('store', 'Dashboard stats failed', { tenantId, error: error.message });
        return {
            totalInspections: 0, totalRisks: 0, highRisks: 0,
            pendingTasks: 0, resolvedPct: 0,
            byCategory: {}, byLevel: {}, byRiskStatus: {}, bySector: [],
            recentInspections: [],
        };
    }
}

export async function saveAiFeedback(data: {
    inspectionId: string;
    tenantId: string;
    aiRisks: any[];
    finalRisks: any[];
    stats: {
        accepted: number;
        edited: number;
        removed: number;
        added: number;
    };
    plant?: string;
    sector?: string;
}): Promise<void> {
    const id = uuidv4();
    try {
        await db.query(`
            INSERT INTO ai_feedback (
                id, inspection_id, tenant_id, ai_risks, final_risks,
                risks_accepted, risks_edited, risks_removed, risks_added,
                plant, sector
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            id, data.inspectionId, data.tenantId,
            JSON.stringify(data.aiRisks), JSON.stringify(data.finalRisks),
            data.stats.accepted, data.stats.edited, data.stats.removed, data.stats.added,
            data.plant, data.sector
        ]);
        logger.info('store', 'AI feedback saved', { inspectionId: data.inspectionId });
    } catch (error: any) {
        logger.error('store', 'Failed to save AI feedback', { error: error.message });
    }
}
