import { InspectionState, DetectedRisk, CorrectiveTask, AuditEntry, deriveInspectionStatus, deriveTaskStatus, Probability, Consequence, RiskAssessment, deriveLevelFromScore } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import db from './_db.js';
import { logger } from './_logger.js';

/**
 * Genera un sello (hash) para una entrada de audit trail.
 * Usa SHA-256 con los campos clave + hash anterior para formar cadena.
 * Soporta versionamiento (1 = legacy 16 chars, 2 = completo 64 chars con payload enriquecido).
 */
export async function generateSeal(entry: Omit<AuditEntry, 'seal'>, previousSeal: string): Promise<string> {
    const { createHash } = await import('crypto');
    const version = entry.sealVersion || 2;
    if (version === 2) {
        const payload = `${entry.inspectorId}|${entry.action}|${entry.riskId}|${entry.fromStatus || ''}|${entry.toStatus || ''}|${entry.note || ''}|${entry.timestamp}|${entry.photoHash || ''}|${previousSeal}`;
        return createHash('sha256').update(payload).digest('hex');
    } else {
        const payload = `${entry.inspectorId}|${entry.action}|${entry.riskId}|${entry.timestamp}|${previousSeal}`;
        return createHash('sha256').update(payload).digest('hex').substring(0, 16);
    }
}

/**
 * Verifica la cadena de custodia y la integridad del audit trail.
 * Detecta cualquier alteración o ruptura y tolera formatos legacy.
 */
export async function verifyAuditChain(
    auditTrail: AuditEntry[],
    tenantId: string,
    currentPhotoHash?: string,
    hasPhoto?: boolean
): Promise<{ valid: boolean; brokenAt?: number; isLegacy?: boolean }> {
    if (!auditTrail || auditTrail.length === 0) {
        return { valid: true };
    }

    let previousSeal = '0000000000000000000000000000000000000000000000000000000000000000';
    let isLegacy = false;

    for (let i = 0; i < auditTrail.length; i++) {
        const entry = auditTrail[i];
        const version = entry.sealVersion || (entry.seal && entry.seal.length === 16 ? 1 : 2);
        
        if (version === 1) {
            isLegacy = true;
            const prev = previousSeal.length > 16 ? previousSeal.substring(0, 16) : previousSeal;
            const recomputed = await generateSeal({ ...entry, sealVersion: 1 }, prev);
            if (recomputed !== entry.seal) {
                return { valid: false, brokenAt: i };
            }
        } else {
            const prev = previousSeal;
            const recomputed = await generateSeal({ ...entry, sealVersion: 2 }, prev);
            if (recomputed !== entry.seal) {
                return { valid: false, brokenAt: i };
            }
        }
        previousSeal = entry.seal;
    }

    // Verificar correspondencia de la foto firmada
    const creationEntry = auditTrail.find(e => e.action === 'inspection_created');
    if (hasPhoto) {
        if (!currentPhotoHash || !creationEntry || !creationEntry.photoHash) {
            // Evidencia legacy no verificable con el esquema nuevo
            isLegacy = true;
        } else if (creationEntry.photoHash !== currentPhotoHash) {
            return { valid: false, brokenAt: -1 }; // Ruptura por alteración de foto
        }
    }

    return { valid: true, isLegacy };
}

/**
 * Realiza comprobaciones de autocontrol sobre el estado de la inspección (Pauta 4.9).
 * Detecta inconsistencias críticas y las reporta en complianceNotes.
 */
export function runAutocontrol(ins: InspectionState): { state: 'completo' | 'con_observaciones'; notes: string } {
    const notes: string[] = [];

    // Check 1: Tarea marcada como resuelta sin responsable o sin descripción de acción
    if (ins.task.status === 'resuelto') {
        if (!ins.task.responsible || ins.task.responsible.trim() === '') {
            notes.push('Tarea resuelta sin responsable asignado.');
        }
        if (!ins.task.action || ins.task.action.trim() === '') {
            notes.push('Tarea resuelta sin acción descripta.');
        }
    }

    // Check 2: Riesgo de nivel 'alto' sin recomendación (acción correctiva)
    const highRisksWithoutAction = (ins.risks || []).filter(r => r.level === 'alto' && (!r.recommendation || r.recommendation.trim() === ''));
    if (highRisksWithoutAction.length > 0) {
        notes.push(`Existen ${highRisksWithoutAction.length} riesgo(s) alto(s) sin recomendación de acción correctiva.`);
    }

    // Check 3: Foto sin hash (evidencia sin integridad criptográfica)
    if (ins.photoUrl && ins.photoUrl.startsWith('photo:')) {
        const creationEntry = ins.auditTrail.find(e => e.action === 'inspection_created');
        if (!creationEntry || !creationEntry.photoHash) {
            notes.push('La inspección contiene foto pero no se registró su firma hash (evidencia legacy).');
        }
    }

    if (notes.length > 0) {
        return { state: 'con_observaciones', notes: notes.join(' ') };
    }
    return { state: 'completo', notes: '' };
}

export async function createInspection(data: {
    inspectionId?: string;
    tenantId: string;
    userId: string;
    userEmail?: string;
    companyId: string;
    companyName?: string;
    plant: string;
    sector: string;
    operator: string;
    risks: DetectedRisk[];
    task: CorrectiveTask;
    aiAnalysis?: any;
    photoUrl?: string;
    photoHash?: string;
    ogcCategory?: string;
}): Promise<InspectionState> {
    const inspectionId = data.inspectionId || uuidv4();
    const now = new Date().toISOString();

    const risksWithHistory = data.risks.map(r => ({
        ...r,
        status: r.status || 'pendiente' as const,
        history: r.history || [],
        updatedBy: data.userId,
        updatedAt: now,
    }));

    // Entrada de auditoría inicial para sellado íntegro en creación
    const initialEntry: Omit<AuditEntry, 'seal'> = {
        id: uuidv4(),
        riskId: 'inspection',
        action: 'inspection_created',
        fromStatus: undefined,
        toStatus: undefined,
        note: 'Inspección creada',
        inspectorId: data.userId,
        inspectorEmail: data.userEmail || '',
        inspectorName: data.operator,
        timestamp: now,
        photoHash: data.photoHash,
        sealVersion: 2,
    };

    const initialSeal = await generateSeal(initialEntry, '0000000000000000000000000000000000000000000000000000000000000000');
    const sealedEntry: AuditEntry = { ...initialEntry, seal: initialSeal };

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
        auditTrail: [sealedEntry],
        aiAnalysis: data.aiAnalysis,
        createdAt: now,
        updatedAt: now,
        ogcCategory: data.ogcCategory,
    };

    const autocontrol = runAutocontrol(state);
    state.complianceState = autocontrol.state;
    state.complianceNotes = autocontrol.notes;

    if (state.status === 'closed') {
        try {
            const { ensureComplianceRecord } = await import('./_inspections/compliance.js');
            await ensureComplianceRecord(inspectionId, state.tenantId, initialSeal);
        } catch (err: any) {
            logger.error('store', 'Failed to generate compliance record on create', { error: err.message });
        }
    }

    if (state.tenantId === 'ensi' && state.complianceState === 'con_observaciones') {
        try {
            const { notifyAlert } = await import('./_notify.js');
            void notifyAlert('compliance_observaciones_detectadas', {
                inspection_id: state.inspectionId,
                tenant_id: state.tenantId,
                observaciones: state.complianceNotes,
                status: state.status
            });
        } catch {}
    }


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
    note?: string,
    newAssessment?: { probability: Probability; consequence: Consequence }
): Promise<InspectionState> {
    const ins = await getInspection(inspectionId);
    if (!ins) throw new Error(`Inspection ${inspectionId} not found`);

    const risk = ins.risks.find(r => r.id === riskId);
    if (!risk) throw new Error(`Risk ${riskId} not found in inspection ${inspectionId}`);

    const oldStatus = risk.status;
    const hasStatusChange = oldStatus !== newStatus;
    const hasAssessmentChange = newAssessment && (
        !risk.assessment || 
        risk.assessment.probability !== newAssessment.probability || 
        risk.assessment.consequence !== newAssessment.consequence
    );

    if (!hasStatusChange && !hasAssessmentChange) return ins;

    const now = new Date().toISOString();

    let lastSeal = ins.auditTrail.length > 0
        ? ins.auditTrail[ins.auditTrail.length - 1].seal
        : '0000000000000000000000000000000000000000000000000000000000000000';

    let photoHash: string | undefined;
    if (ins.photoUrl && ins.photoUrl.startsWith('photo:')) {
        const photoId = ins.photoUrl.replace('photo:', '');
        try {
            const photoRes = await db.query('SELECT photo_hash FROM photos WHERE photo_id = $1', [photoId]);
            if (photoRes.rows.length > 0) {
                photoHash = photoRes.rows[0].photo_hash;
            }
        } catch {}
    }

    const newSealedEntries: AuditEntry[] = [];

    if (hasAssessmentChange && newAssessment) {
        const oldProb = risk.assessment?.probability;
        const oldCons = risk.assessment?.consequence;
        
        const score = newAssessment.probability * newAssessment.consequence;
        const derivedLevel = deriveLevelFromScore(score);
        
        risk.assessment = {
            probability: newAssessment.probability,
            consequence: newAssessment.consequence,
            score,
            level: derivedLevel,
            source: 'inspector',
            confirmedBy: user.userId,
            confirmedAt: now,
            probabilityJustification: risk.assessment?.probabilityJustification,
            consequenceJustification: risk.assessment?.consequenceJustification
        };
        risk.level = derivedLevel;
        risk.updatedBy = user.email;
        risk.updatedAt = now;

        const auditEntry: Omit<AuditEntry, 'seal'> = {
            id: uuidv4(),
            riskId,
            action: 'risk_edited',
            note: note || `Evaluación de riesgo ajustada de P:${oldProb || '?'}/C:${oldCons || '?'} a P:${newAssessment.probability}/C:${newAssessment.consequence} (${derivedLevel})`,
            inspectorId: user.userId,
            inspectorEmail: user.email,
            inspectorName: user.displayName || user.email,
            timestamp: now,
            photoHash,
            sealVersion: 2,
        };

        const seal = await generateSeal(auditEntry, lastSeal);
        const sealedEntry: AuditEntry = { ...auditEntry, seal };
        lastSeal = seal;

        if (!risk.history) risk.history = [];
        risk.history.push(sealedEntry);
        if (!ins.auditTrail) ins.auditTrail = [];
        ins.auditTrail.push(sealedEntry);
        newSealedEntries.push(sealedEntry);
    }

    if (hasStatusChange) {
        risk.status = newStatus as any;
        risk.updatedBy = user.email;
        risk.updatedAt = now;

        const auditEntry: Omit<AuditEntry, 'seal'> = {
            id: uuidv4(),
            riskId,
            action: 'status_change',
            fromStatus: oldStatus as any,
            toStatus: newStatus as any,
            note: hasAssessmentChange ? undefined : note,
            inspectorId: user.userId,
            inspectorEmail: user.email,
            inspectorName: user.displayName || user.email,
            timestamp: now,
            photoHash,
            sealVersion: 2,
        };

        const seal = await generateSeal(auditEntry, lastSeal);
        const sealedEntry: AuditEntry = { ...auditEntry, seal };
        lastSeal = seal;

        if (!risk.history) risk.history = [];
        risk.history.push(sealedEntry);
        if (!ins.auditTrail) ins.auditTrail = [];
        ins.auditTrail.push(sealedEntry);
        newSealedEntries.push(sealedEntry);
    }

    ins.status = deriveInspectionStatus(ins.risks);
    ins.task.status = deriveTaskStatus(ins.risks);

    if (ins.task.status === 'resuelto' && !ins.task.resolvedAt) {
        ins.task.resolvedAt = now;
        ins.task.resolvedBy = user.email;
        /*
         * FUTURE ANCHORING POINT (Anclaje Externo Futuro):
         * Aquí es donde la inspección ha quedado completamente resuelta/cerrada y su cadena de custodia está completa.
         * En este punto exacto se debería calcular el closing_hash de la inspección y enviarlo a:
         * 1. Una Autoridad de Sellado de Tiempo (TSA conforme a RFC 3161) para obtener un timestamp provisto por un tercero de confianza.
         * 2. O anclar el hash en una blockchain (ej. Ethereum, Bitcoin o una red regulada local de AR) publicando una transacción inmutable.
         * Esto permitiría pasar de integridad propia (cadena interna de hashes) a integridad demostrable e inalterable ante terceros.
         */
    }

    // Ejecutar autocontrol (Pauta 4.9)
    const autocontrol = runAutocontrol(ins);
    ins.complianceState = autocontrol.state;
    ins.complianceNotes = autocontrol.notes;

    if (ins.status === 'closed') {
        const closingHash = lastSeal;
        try {
            const { ensureComplianceRecord } = await import('./_inspections/compliance.js');
            await ensureComplianceRecord(inspectionId, ins.tenantId, closingHash);
        } catch (err: any) {
            logger.error('store', 'Failed to generate compliance record on close', { error: err.message });
        }
    }

    if (ins.tenantId === 'ensi' && ins.complianceState === 'con_observaciones') {
        try {
            const { notifyAlert } = await import('./_notify.js');
            void notifyAlert('compliance_observaciones_detectadas', {
                inspection_id: ins.inspectionId,
                tenant_id: ins.tenantId,
                observaciones: ins.complianceNotes,
                status: ins.status
            });
        } catch {}
    }

    ins.updatedAt = now;

    try {
        await db.query(`
            UPDATE inspections SET state = $1, updated_at = CURRENT_TIMESTAMP
            WHERE inspection_id = $2
        `, [JSON.stringify(ins), inspectionId]);

        for (const entry of newSealedEntries) {
            await db.query(`
                INSERT INTO audit_trail (id, inspection_id, tenant_id, risk_id, action, from_status, to_status, note, inspector_id, inspector_email, inspector_name, seal, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [
                entry.id, inspectionId, ins.tenantId, riskId,
                entry.action, entry.fromStatus || null, entry.toStatus || null, entry.note || null,
                user.userId, user.email, user.displayName || user.email,
                entry.seal, now
            ]);
        }

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
    assessmentStats?: {
        acceptedWithoutChange: number;
        adjusted: number;
        up: number;
        down: number;
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
                plant, sector, assessment_stats
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
            id, data.inspectionId, data.tenantId,
            JSON.stringify(data.aiRisks), JSON.stringify(data.finalRisks),
            data.stats.accepted, data.stats.edited, data.stats.removed, data.stats.added,
            data.plant, data.sector,
            data.assessmentStats ? JSON.stringify(data.assessmentStats) : null
        ]);
        logger.info('store', 'AI feedback saved', { inspectionId: data.inspectionId });
    } catch (error: any) {
        logger.error('store', 'Failed to save AI feedback', { error: error.message });
    }
}
