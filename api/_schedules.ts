import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from './_db.js';
import { logger } from './_logger.js';

/**
 * Interface para una inspección programada.
 */
export interface ScheduledInspection {
    id: string;
    companyId: string;
    companyName: string;
    inspectorId: string;
    inspectorName: string;
    scheduledDate: string;
    status: 'programada' | 'realizada' | 'reprogramada' | 'vencida';
    recurrence: string;
    createdAt: string;
    notes?: string;
    rescheduleHistory?: any[];
    linkedInspectionId?: string;
    completedAt?: string;
}

/**
 * POST /api/schedules/create
 */
export async function createScheduleHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const { companyId, inspectorId, scheduledDate, status, recurrence, notes, companyName, inspectorName } = req.body;

        if (!companyId || !inspectorId || !scheduledDate) {
            return res.status(400).json({ error: 'companyId, inspectorId, and scheduledDate are required' });
        }

        const id = uuidv4();
        const now = new Date().toISOString();
        
        const scheduleData: Omit<ScheduledInspection, 'id'> = {
            companyId,
            companyName: companyName || '',
            inspectorId,
            inspectorName: inspectorName || '',
            scheduledDate,
            status: status || 'programada',
            recurrence: recurrence || 'none',
            notes,
            createdAt: now,
            rescheduleHistory: []
        };

        await db.query(`
            INSERT INTO schedules (id, tenant_id, company_id, inspector_id, scheduled_date, status, data)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, user.tenantId, companyId, inspectorId, scheduledDate, scheduleData.status, JSON.stringify(scheduleData)]);

        res.json({ ok: true, schedule: { id, ...scheduleData } });
    } catch (error: any) {
        logger.error('schedules', 'Failed to create schedule', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/schedules/list
 */
export async function listSchedulesHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const { inspectorId, companyId, status } = req.query;

        const conditions: string[] = ['tenant_id = $1'];
        const values: any[] = [user.tenantId];
        let pIndex = 2;

        if (inspectorId) {
            conditions.push(`inspector_id = $${pIndex++}`);
            values.push(inspectorId);
        } else if (user.role === 'inspector') {
            // Los inspectores solo ven lo suyo
            conditions.push(`inspector_id = $${pIndex++}`);
            values.push(user.userId);
        }

        if (companyId) {
            conditions.push(`company_id = $${pIndex++}`);
            values.push(companyId);
        }

        if (status) {
            conditions.push(`status = $${pIndex++}`);
            values.push(status);
        }

        const where = conditions.join(' AND ');
        const result = await db.query(`
            SELECT id, status, data FROM schedules 
            WHERE ${where} 
            ORDER BY scheduled_date ASC
        `, values);

        const schedules = result.rows.map(r => ({
            id: r.id,
            ...r.data,
            status: r.status // Asegurar que el status de la columna mande
        }));

        res.json({ ok: true, schedules });
    } catch (error: any) {
        logger.error('schedules', 'Failed to list schedules', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

/**
 * PUT /api/schedules/:id
 */
export async function updateScheduleHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const { id } = req.params;
        const updates = req.body;

        const existing = await db.query('SELECT * FROM schedules WHERE id = $1 AND tenant_id = $2', [id, user.tenantId]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

        const current = existing.rows[0];
        const newData = { ...current.data, ...updates };
        
        // Sincronizar campos de primer nivel si vienen en el body
        const newStatus = updates.status || current.status;
        const newDate = updates.scheduledDate || current.scheduled_date;

        await db.query(`
            UPDATE schedules 
            SET status = $1, scheduled_date = $2, data = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [newStatus, newDate, JSON.stringify(newData), id]);

        res.json({ ok: true, schedule: { id, ...newData, status: newStatus } });
    } catch (error: any) {
        logger.error('schedules', 'Failed to update schedule', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

/**
 * DELETE /api/schedules/:id
 */
export async function deleteScheduleHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const { id } = req.params;

        if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

        await db.query('DELETE FROM schedules WHERE id = $1 AND tenant_id = $2', [id, user.tenantId]);
        res.json({ ok: true });
    } catch (error: any) {
        logger.error('schedules', 'Failed to delete schedule', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}
