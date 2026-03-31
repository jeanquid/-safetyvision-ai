import { Request, Response } from 'express';
import { createInspection, getInspection, updateInspection, listInspections, deleteInspection, getDashboardStats } from '../_store.js';
import { analyzeImageWithGemini, analyzeTextDescription } from '../_ai-engine.js';
import { notifyAlert } from '../_notify.js';
import { DetectedRisk } from '../_types.js';

/** POST /api/inspections/analyze — AI image/text analysis */
export const analyzeHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { imageBase64, mimeType, description, plant, sector } = req.body;

        if (!imageBase64 && !description) {
            return res.status(400).json({ error: 'imageBase64 or description required' });
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
        console.error('[ANALYZE] Error:', error);
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

        res.json({ ok: true, inspectionId: inspection.inspectionId, state: inspection });
    } catch (error: any) {
        console.error('[CREATE] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/** GET /api/inspections/list */
export const listHandler = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { plant, status, level, limit } = req.query;

        const inspections = await listInspections(user.tenantId, {
            plant: plant as string,
            status: status as string,
            level: level as string,
            limit: limit ? parseInt(limit as string) : undefined,
        });

        // Return summary (no heavy base64 photos)
        const summary = inspections.map(i => ({
            ...i,
            photoUrl: i.photoUrl ? '[has_photo]' : null,
        }));

        res.json({ ok: true, inspections: summary, total: inspections.length });
    } catch (error: any) {
        console.error('[LIST] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/** GET /api/inspections/:id */
export const getHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const inspection = await getInspection(id);
        if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

        res.json({ ok: true, inspection });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/** POST /api/inspections/:id/update-task — Update task status */
export const updateTaskHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const { status, notes } = req.body;

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
        console.error('[UPDATE_TASK] Error:', error);
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
        await deleteInspection(req.params.id);
        res.json({ ok: true });
    } catch (error: any) {
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
        console.error('[DASHBOARD] Error:', error);
        res.status(500).json({ error: error.message });
    }
};
