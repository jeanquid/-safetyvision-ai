import { Request, Response } from 'express';
import { compressImage } from '../_compress-image.js';
import { createInspection, getInspection, updateInspection, listInspections, deleteInspection, getDashboardStats, saveAiFeedback, updateRiskStatus } from '../_store.js';
import { savePhoto } from '../_storage.js';
import { analyzeImageWithGemini, analyzeTextDescription, validateImage } from '../_ai-engine.js';
import { notifyAlert } from '../_notify.js';
import { DetectedRisk, deriveInspectionStatus, deriveTaskStatus } from '../_types.js';
import { logger } from '../_logger.js';
import { v4 as uuidv4 } from 'uuid';

/** POST /api/inspections/analyze — AI image/text analysis */
export const analyzeHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let { imageBase64, mimeType, description, plant, sector } = req.body;

        if (!imageBase64 && !description) {
            return res.status(400).json({ error: 'imageBase64 or description required' });
        }

        let compressionStats;
        if (imageBase64) {
            const compressed = await compressImage(imageBase64, mimeType || 'image/jpeg');
            imageBase64 = compressed.base64;
            mimeType = compressed.mimeType;
            compressionStats = {
                originalKB: compressed.originalSizeKB,
                compressedKB: compressed.compressedSizeKB,
                reduction: compressed.reductionPct,
            };

            const validation = await validateImage(imageBase64, mimeType || 'image/jpeg');
            if (!validation.valid) {
                return res.status(400).json({
                    ok: false,
                    error: 'La imagen no parece ser de un entorno laboral o industrial.',
                    reason: validation.reason,
                });
            }
        }

        let result;
        if (imageBase64) {
            result = await analyzeImageWithGemini(imageBase64, mimeType || 'image/jpeg', { plant, sector });
        } else {
            result = await analyzeTextDescription(description, { plant, sector });
        }

        res.json({
            ok: true,
            risks: result.risks,
            model: result.model,
            analyzedAt: new Date().toISOString(),
            compression: compressionStats,
        });
    } catch (error: any) {
        logger.error('inspections', 'Analysis failed', { error: error.message });
        res.status(500).json({ error: error.message || 'AI analysis failed' });
    }
};

/** POST /api/inspections/create — Save a completed inspection */
export const createHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { companyId, companyName, plant, sector, operator, risks, task, aiAnalysis, photoUrl } = req.body;

        if (!companyId || !plant || !risks || !task) {
            return res.status(400).json({ error: 'companyId, plant, risks, and task are required' });
        }

        const enrichedRisks = (risks as DetectedRisk[]).map(r => ({
            ...r,
            status: r.status || 'pendiente' as const,
            history: [],
        }));

        const inspectionId = uuidv4();
        let photoId: string | undefined;
        let photoHash: string | undefined;
        let finalPhotoUrl = photoUrl;

        if (req.body.imageBase64) {
            const saved = await savePhoto(
                inspectionId,
                req.body.imageBase64,
                req.body.mimeType || 'image/jpeg'
            );
            photoId = saved.photoId;
            photoHash = saved.hash;
            finalPhotoUrl = `photo:${photoId}`;
        }

        const inspection = await createInspection({
            inspectionId,
            tenantId: user.tenantId,
            userId: user.userId,
            userEmail: user.email,
            companyId,
            companyName,
            plant,
            sector: sector || 'Sin especificar',
            operator: operator || user.displayName || user.email,
            risks: enrichedRisks,
            task,
            aiAnalysis,
            photoUrl: finalPhotoUrl,
            photoHash,
        });

        const hasHigh = enrichedRisks.some((r: DetectedRisk) => r.level === 'alto');
        if (hasHigh) {
            void notifyAlert('riesgo_alto_detectado', {
                inspection_id: inspection.inspectionId,
                plant,
                sector,
                operator,
                riesgos_altos: enrichedRisks.filter((r: DetectedRisk) => r.level === 'alto').length,
                accion: task.action,
                responsable: task.responsible,
                plazo: task.deadline,
            });
        }

        if (aiAnalysis?.originalRisks) {
            const original = aiAnalysis.originalRisks || [];
            const final = enrichedRisks || [];
            const stats = { accepted: 0, edited: 0, removed: 0, added: 0 };
            const finalIds = new Set(final.map((r: any) => r.id));
            const originalIds = new Set(original.map((r: any) => r.id));
            original.forEach((r: any) => { if (finalIds.has(r.id)) stats.accepted++; else stats.removed++; });
            final.forEach((r: any) => { if (!originalIds.has(r.id)) stats.added++; });

            const assessmentStats = {
                acceptedWithoutChange: 0,
                adjusted: 0,
                up: 0,
                down: 0
            };

            final.forEach((fRisk: any) => {
                const origRisk = original.find((o: any) => o.id === fRisk.id);
                if (origRisk && origRisk.assessment && fRisk.assessment) {
                    const oScore = origRisk.assessment.score;
                    const fScore = fRisk.assessment.score;
                    if (oScore === fScore && fRisk.assessment.source === 'ai') {
                        assessmentStats.acceptedWithoutChange++;
                    } else {
                        assessmentStats.adjusted++;
                        if (fScore > oScore) {
                            assessmentStats.up++;
                        } else if (fScore < oScore) {
                            assessmentStats.down++;
                        }
                    }
                }
            });

            void saveAiFeedback({
                inspectionId: inspection.inspectionId,
                tenantId: user.tenantId,
                aiRisks: original,
                finalRisks: final,
                stats,
                assessmentStats,
                plant,
                sector
            });
        }

        res.json({ ok: true, inspectionId: inspection.inspectionId, state: inspection });
    } catch (error: any) {
        logger.error('inspections', 'Create inspection failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/** GET /api/inspections/list */
export const listHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { companyId, plant, status, level, limit, offset } = req.query;

        const { inspections, total } = await listInspections(user.tenantId, {
            companyId: companyId as string,
            plant: plant as string,
            status: status as string,
            level: level as string,
            limit: limit ? parseInt(limit as string) : 50,
            offset: offset ? parseInt(offset as string) : 0,
        });

        const summary = inspections.map(i => ({
            ...i,
            photoUrl: i.photoUrl ? '[has_photo]' : null,
        }));

        res.json({ ok: true, inspections: summary, total, hasMore: (offset ? parseInt(offset as string) : 0) + summary.length < total });
    } catch (error: any) {
        logger.error('inspections', 'List inspections failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/** GET /api/inspections/:id */
export const getHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const id = req.params.id as string;
        const inspection = await getInspection(id);

        if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

        if (inspection.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        let resolvedPhotoUrl: string | null = null;
        if (inspection.photoUrl && inspection.photoUrl.startsWith('photo:')) {
            const photoId = inspection.photoUrl.replace('photo:', '');
            resolvedPhotoUrl = `/api/photos/${photoId}`;
        }

        res.json({
            ok: true,
            inspection: { ...inspection, resolvedPhotoUrl },
        });
    } catch (error: any) {
        logger.error('inspections', 'Get inspection failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/**
 * PATCH /api/inspections/:id/risks/:riskId — Actualizar status o evaluación de un riesgo individual
 * Body: { status?: 'pendiente' | 'en_progreso' | 'resuelto', note?: string, probability?: number, consequence?: number }
 */
export const updateRiskHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const id = req.params.id as string;
        const riskId = req.params.riskId as string;
        const { status, note, probability, consequence } = req.body;

        const existing = await getInspection(id);
        if (!existing) return res.status(404).json({ error: 'Inspection not found' });
        if (existing.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const risk = existing.risks.find(r => r.id === riskId);
        if (!risk) return res.status(404).json({ error: 'Risk not found' });

        const targetStatus = status || risk.status;
        if (!['pendiente', 'en_progreso', 'resuelto'].includes(targetStatus)) {
            return res.status(400).json({ error: 'Invalid status. Must be: pendiente, en_progreso, resuelto' });
        }

        let newAssessment;
        if (probability !== undefined && consequence !== undefined) {
            const p = parseInt(probability, 10);
            const c = parseInt(consequence, 10);
            if (p >= 1 && p <= 5 && c >= 1 && c <= 5) {
                newAssessment = { probability: p as any, consequence: c as any };
            } else {
                return res.status(400).json({ error: 'probability and consequence must be integers between 1 and 5' });
            }
        }

        const updated = await updateRiskStatus(id, riskId, targetStatus, {
            userId: user.userId,
            email: user.email,
            displayName: user.displayName,
        }, note, newAssessment);

        if (updated.status === 'closed' && existing.status !== 'closed') {
            void notifyAlert('tarea_resuelta', {
                inspection_id: id,
                plant: updated.plant,
                sector: updated.sector,
                resuelto_por: user.email,
            });
        }

        res.json({ ok: true, inspection: updated });
    } catch (error: any) {
        logger.error('inspections', 'Update risk status failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/** POST /api/inspections/:id/update-task — LEGACY: bulk status update (backwards compatible) */
export const updateTaskHandler = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const user = (req as any).user;
        const { status, notes } = req.body;

        const existing = await getInspection(id);
        if (!existing) return res.status(404).json({ error: 'Inspection not found' });
        if (existing.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['pendiente', 'en_progreso', 'resuelto'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        for (const risk of existing.risks) {
            if (risk.status !== status) {
                await updateRiskStatus(id, risk.id, status, {
                    userId: user.userId,
                    email: user.email,
                    displayName: user.displayName,
                }, notes || `Cambio masivo de estado a ${status}`);
            }
        }

        const updated = await getInspection(id);

        if (status === 'resuelto') {
            void notifyAlert('tarea_resuelta', {
                inspection_id: id,
                plant: updated!.plant,
                sector: updated!.sector,
                resuelto_por: user.email,
            });
        }

        res.json({ ok: true, inspection: updated });
    } catch (error: any) {
        logger.error('inspections', 'Update task failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/** DELETE /api/inspections/:id */
export const deleteHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can delete inspections' });
        }

        const existing = await getInspection(req.params.id as string);
        if (!existing) return res.status(404).json({ error: 'Inspection not found' });
        if (existing.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await deleteInspection(req.params.id as string);
        res.json({ ok: true });
    } catch (error: any) {
        logger.error('inspections', 'Delete inspection failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/** GET /api/dashboard */
export const dashboardHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = req.query.companyId as string | undefined;
        const stats = await getDashboardStats(user.tenantId, companyId);
        res.json({ ok: true, ...stats });
    } catch (error: any) {
        logger.error('inspections', 'Dashboard fetch failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};
