import { Request, Response } from 'express';
import { createInspection, getInspection, updateInspection, listInspections, deleteInspection, getDashboardStats } from '../_store.js';
import { savePhoto } from '../_storage.js';
import { analyzeImageWithGemini, analyzeTextDescription, validateImage } from '../_ai-engine.js';
import { notifyAlert } from '../_notify.js';
import { DetectedRisk } from '../_types.js';
import { logger } from '../_logger.js';

/** POST /api/inspections/analyze — AI image/text analysis */
export const analyzeHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { imageBase64, mimeType, description, plant, sector } = req.body;

        if (!imageBase64 && !description) {
            return res.status(400).json({ error: 'imageBase64 or description required' });
        }

        // --- PHASE 4: Industrial Validation ---
        if (imageBase64) {
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
        const { plant, sector, operator, risks, task, aiAnalysis, photoUrl } = req.body;

        if (!plant || !risks || !task) {
            return res.status(400).json({ error: 'plant, risks, and task are required' });
        }

        const inspection = await createInspection({
            tenantId: user.tenantId,
            userId: user.userId,
            plant,
            sector: sector || 'Sin especificar',
            operator: operator || user.displayName || user.email,
            risks,
            task,
            aiAnalysis,
            photoUrl,
        });

        // Send alert for high-risk detections
        const hasHigh = risks.some((r: DetectedRisk) => r.level === 'alto');
        if (hasHigh) {
            void notifyAlert('riesgo_alto_detectado', {
                inspection_id: inspection.inspectionId,
                plant,
                sector,
                operator,
                riesgos_altos: risks.filter((r: DetectedRisk) => r.level === 'alto').length,
                accion: task.action,
                responsable: task.responsible,
                plazo: task.deadline,
            });
        }

        // --- PHASE 2: Persist photo if present ---
        let photoId: string | undefined;
        if (req.body.imageBase64) {
            photoId = await savePhoto(
                inspection.inspectionId,
                req.body.imageBase64,
                req.body.mimeType || 'image/jpeg'
            );
        }

        // Actualizar el state con la referencia a la foto
        if (photoId) {
            await updateInspection(inspection.inspectionId, (ins) => {
                ins.photoUrl = `photo:${photoId}`;
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
        const { plant, status, level, limit, offset } = req.query;

        const { inspections, total } = await listInspections(user.tenantId, {
            plant: plant as string,
            status: status as string,
            level: level as string,
            limit: limit ? parseInt(limit as string) : 50,
            offset: offset ? parseInt(offset as string) : 0,
        });

        // Return summary (no heavy base64 photos)
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

        // CRITICAL: validar que pertenece al tenant del usuario
        if (inspection.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ ok: true, inspection });
    } catch (error: any) {
        logger.error('inspections', 'Get inspection failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};

/** POST /api/inspections/:id/update-task — Update task status */
export const updateTaskHandler = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const user = (req as any).user;
        const { status, notes } = req.body;

        // Validar tenant ANTES de actualizar
        const existing = await getInspection(id);
        if (!existing) return res.status(404).json({ error: 'Inspection not found' });
        if (existing.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['pendiente', 'en_progreso', 'resuelto'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updated = await updateInspection(id, (ins) => {
            ins.task.status = status;
            if (notes) ins.task.notes = notes;
            if (status === 'resuelto') {
                ins.task.resolvedAt = new Date().toISOString();
                ins.task.resolvedBy = user.email;
                ins.status = 'closed';
                // Mark all risks as resolved
                ins.risks.forEach(r => { r.status = 'resuelto'; });
            } else if (status === 'en_progreso') {
                ins.status = 'active';
            }
        });

        if (status === 'resuelto') {
            void notifyAlert('tarea_resuelta', {
                inspection_id: id,
                plant: updated.plant,
                sector: updated.sector,
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

        // Validar tenant
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
        const stats = await getDashboardStats(user.tenantId);
        res.json({ ok: true, ...stats });
    } catch (error: any) {
        logger.error('inspections', 'Dashboard fetch failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
};
