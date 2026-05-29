import { Request, Response } from 'express';
import { getInspection, verifyAuditChain } from '../_store.js';
import db from '../_db.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../_logger.js';
import crypto from 'crypto';

/**
 * GET /api/inspections/:id/verify
 * Verifica la integridad criptográfica de la cadena de firmas de la inspección.
 * Solo disponible para 'admin'.
 */
export async function verifyHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere rol Administrador.' });
        }

        const id = req.params.id;
        const inspection = await getInspection(id);
        if (!inspection) {
            return res.status(404).json({ error: 'Inspección no encontrada.' });
        }

        if (inspection.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Acceso denegado: La inspección pertenece a otro tenant.' });
        }

        // Obtener hash de la foto actual para verificar cadena de custodia
        let currentPhotoHash: string | undefined;
        if (inspection.photoUrl && inspection.photoUrl.startsWith('photo:')) {
            const photoId = inspection.photoUrl.replace('photo:', '');
            const photoRes = await db.query('SELECT photo_hash FROM photos WHERE photo_id = $1', [photoId]);
            if (photoRes.rows.length > 0) {
                currentPhotoHash = photoRes.rows[0].photo_hash;
            }
        }

        const verification = await verifyAuditChain(inspection.auditTrail, inspection.tenantId, currentPhotoHash, !!inspection.photoUrl);

        // Registrar acceso a la auditoría (Pauta 4.8)
        await db.query(`
            INSERT INTO audit_access_logs (id, user_id, email, role, inspection_id, action_performed, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuidv4(), user.userId, user.email, user.role, id, 'verify_chain_accessed', user.tenantId]);

        res.json({
            ok: true,
            valid: verification.valid,
            isLegacy: verification.isLegacy,
            brokenAt: verification.brokenAt
        });
    } catch (error: any) {
        logger.error('compliance', 'Verification failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/inspections/:id/export?format=json|csv
 * Exporta la inspección en formato estructurado (JSON o CSV).
 * Solo disponible para 'admin'.
 */
export async function exportHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere rol Administrador.' });
        }

        const id = req.params.id;
        const format = (req.query.format as string || 'json').toLowerCase();

        const inspection = await getInspection(id);
        if (!inspection) {
            return res.status(404).json({ error: 'Inspección no encontrada.' });
        }

        if (inspection.tenantId !== user.tenantId) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        // Registrar acceso (Pauta 4.8)
        await db.query(`
            INSERT INTO audit_access_logs (id, user_id, email, role, inspection_id, action_performed, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuidv4(), user.userId, user.email, user.role, id, `export_${format}_accessed`, user.tenantId]);

        if (format === 'csv') {
            let csv = 'inspection_id,tenant_id,company_id,plant,sector,operator,status,created_at,risk_id,risk_category,risk_description,risk_level,risk_status,risk_recommendation\n';
            for (const r of inspection.risks) {
                csv += `"${inspection.inspectionId}","${inspection.tenantId}","${inspection.companyId}","${inspection.plant}","${inspection.sector}","${inspection.operator}","${inspection.status}","${inspection.createdAt}","${r.id}","${r.category}","${r.description.replace(/"/g, '""')}","${r.level}","${r.status}","${(r.recommendation || '').replace(/"/g, '""')}"\n`;
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="export-inspeccion-${id.substring(0, 8)}.csv"`);
            return res.send(csv);
        }

        // Formato JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="export-inspeccion-${id.substring(0, 8)}.json"`);
        return res.send(JSON.stringify(inspection, null, 2));
    } catch (error: any) {
        logger.error('compliance', 'Export failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/companies/:companyId/export?format=json|csv
 * Exporta todas las inspecciones de una empresa específica.
 * Solo disponible para 'admin'.
 */
export async function exportCompanyHandler(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado: Se requiere rol Administrador.' });
        }

        const companyId = req.params.companyId;
        const format = (req.query.format as string || 'json').toLowerCase();

        // Verificar que la empresa pertenece al tenant
        const companyRes = await db.query('SELECT name, tenant_id FROM companies WHERE company_id = $1', [companyId]);
        if (companyRes.rows.length === 0) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }
        if (companyRes.rows[0].tenant_id !== user.tenantId) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const companyName = companyRes.rows[0].name;

        // Obtener todas las inspecciones de la empresa
        const queryRes = await db.query(
            `SELECT state FROM inspections WHERE company_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
            [companyId, user.tenantId]
        );

        const inspections = queryRes.rows.map(r => r.state);

        // Registrar acceso
        await db.query(`
            INSERT INTO audit_access_logs (id, user_id, email, role, inspection_id, action_performed, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuidv4(), user.userId, user.email, user.role, companyId, `export_company_${format}_accessed`, user.tenantId]);

        if (format === 'csv') {
            let csv = 'inspection_id,tenant_id,company_id,company_name,plant,sector,operator,status,created_at,risk_id,risk_category,risk_description,risk_level,risk_status,risk_recommendation\n';
            for (const ins of inspections) {
                for (const r of (ins.risks || [])) {
                    csv += `"${ins.inspectionId}","${ins.tenantId}","${ins.companyId}","${companyName}","${ins.plant}","${ins.sector}","${ins.operator}","${ins.status}","${ins.createdAt}","${r.id}","${r.category}","${r.description.replace(/"/g, '""')}","${r.level}","${r.status}","${(r.recommendation || '').replace(/"/g, '""')}"\n`;
                }
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="export-empresa-${companyId.substring(0, 8)}.csv"`);
            return res.send(csv);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="export-empresa-${companyId.substring(0, 8)}.json"`);
        return res.send(JSON.stringify(inspections, null, 2));
    } catch (error: any) {
        logger.error('compliance', 'Company export failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/verify/:publicId
 * Endpoint público sin autenticación. Devuelve metadatos no sensibles para verificar una constancia.
 * Si se solicita HTML (Accept: text/html), renderiza una página web premium con branding de ENSI.
 */
export async function publicVerifyHandler(req: Request, res: Response) {
    try {
        const publicId = req.params.publicId;

        // Buscar el registro de cumplimiento
        const recordRes = await db.query(
            'SELECT * FROM compliance_records WHERE public_id = $1',
            [publicId]
        );

        if (recordRes.rows.length === 0) {
            if (req.headers.accept?.includes('text/html')) {
                return res.status(404).send(renderNotFoundHtml(publicId));
            }
            return res.status(404).json({ error: 'Constancia de cumplimiento no encontrada.' });
        }

        const record = recordRes.rows[0];

        // Obtener la inspección asociada
        const inspection = await getInspection(record.inspection_id);
        if (!inspection) {
            return res.status(404).json({ error: 'Inspección asociada no encontrada.' });
        }

        // Obtener nombre comercial del tenant
        const tenantRes = await db.query('SELECT name FROM tenants WHERE tenant_id = $1', [record.tenant_id]);
        const tenantName = tenantRes.rows.length > 0 ? tenantRes.rows[0].name : 'ENSI S.E.';

        // Obtener hash de la foto actual para verificar cadena de custodia
        let currentPhotoHash: string | undefined;
        if (inspection.photoUrl && inspection.photoUrl.startsWith('photo:')) {
            const photoId = inspection.photoUrl.replace('photo:', '');
            const photoRes = await db.query('SELECT photo_hash FROM photos WHERE photo_id = $1', [photoId]);
            if (photoRes.rows.length > 0) {
                currentPhotoHash = photoRes.rows[0].photo_hash;
            }
        }

        // Verificar la cadena criptográfica
        const verification = await verifyAuditChain(inspection.auditTrail, record.tenant_id, currentPhotoHash, !!inspection.photoUrl);
        const chainStatus = verification.valid ? (verification.isLegacy ? 'legacy' : 'valid') : 'altered';

        // Actualizar tabla compliance_records si la validez de la cadena cambió
        if (record.chain_valid !== verification.valid) {
            await db.query(
                'UPDATE compliance_records SET chain_valid = $1 WHERE public_id = $2',
                [verification.valid, publicId]
            );
        }

        // Registrar acceso a la verificación pública (Pauta 4.8)
        await db.query(`
            INSERT INTO audit_access_logs (id, user_id, email, role, inspection_id, action_performed, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [uuidv4(), null, 'anonymous', 'public', record.inspection_id, 'public_verify_accessed', record.tenant_id]);

        const responsePayload = {
            ok: true,
            exists: true,
            publicId: record.public_id,
            issuedAt: record.issued_at,
            tenant: tenantName,
            chainStatus: chainStatus,
            closingHash: record.closing_hash
        };

        if (req.headers.accept?.includes('text/html')) {
            return res.send(renderVerificationHtml(responsePayload, inspection));
        }

        res.json(responsePayload);
    } catch (error: any) {
        logger.error('compliance', 'Public verification handler failed', { error: error.message });
        if (req.headers.accept?.includes('text/html')) {
            return res.status(500).send(`<h3>Error de servidor: ${error.message}</h3>`);
        }
        res.status(500).json({ error: error.message });
    }
}

/**
 * Asegura la existencia de un compliance_record para una inspección cerrada.
 * Genera un publicId criptográfico e inalterable.
 */
export async function ensureComplianceRecord(inspectionId: string, tenantId: string, closingHash: string): Promise<string> {
    const existing = await db.query('SELECT public_id FROM compliance_records WHERE inspection_id = $1', [inspectionId]);
    if (existing.rows.length > 0) {
        return existing.rows[0].public_id;
    }

    const publicId = crypto.randomBytes(16).toString('hex'); // 32 caracteres hexadecimales aleatorios
    const id = uuidv4();

    await db.query(`
        INSERT INTO compliance_records (id, inspection_id, public_id, closing_hash, chain_valid, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, inspectionId, publicId, closingHash, true, tenantId]);

    logger.info('compliance', 'Compliance record created', { inspectionId, publicId });
    return publicId;
}

// ── Vistas HTML Premium ───────────────────────────────────────────────────────

function renderVerificationHtml(data: any, inspection: any) {
    const dateFormatted = new Date(data.issuedAt).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isEnsi = inspection.tenantId === 'ensi';
    const primaryColor = isEnsi ? '#003A70' : '#16a34a';
    const accentColor = isEnsi ? '#005FA3' : '#22c55e';
    const brandName = isEnsi ? 'ENSI S.E.' : 'HSE Ingeniería';

    let badgeText = 'Cadena de Custodia Válida';
    let badgeColor = '#dcfce7';
    let badgeTextColor = '#15803d';
    let badgeIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>`;

    if (data.chainStatus === 'legacy') {
        badgeText = 'Evidencia Legacy (Sin firmar)';
        badgeColor = '#fef3c7';
        badgeTextColor = '#b45309';
        badgeIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    } else if (data.chainStatus === 'altered') {
        badgeText = 'Cadena de Custodia Corrupta / Alterada';
        badgeColor = '#fee2e2';
        badgeTextColor = '#b91c1c';
        badgeIcon = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    }

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verificación de Constancia - Prevención 4.0</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Outfit', sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .background-glow {
                position: absolute;
                width: 300px;
                height: 300px;
                background: ${primaryColor};
                opacity: 0.15;
                filter: blur(100px);
                border-radius: 50%;
                z-index: 0;
            }
            .card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px rgba(255, 255, 255, 0.08) solid;
                border-radius: 24px;
                padding: 40px 30px;
                width: 100%;
                max-width: 550px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                text-align: center;
                z-index: 1;
            }
            .logo-container {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 50px;
                margin-bottom: 24px;
                border: 1px rgba(255, 255, 255, 0.1) solid;
            }
            .logo-text {
                font-weight: 700;
                font-size: 1.1rem;
                letter-spacing: 0.05em;
                color: #ffffff;
            }
            .title {
                font-weight: 700;
                font-size: 1.6rem;
                color: #ffffff;
                margin-bottom: 8px;
            }
            .subtitle {
                font-size: 0.9rem;
                color: #94a3b8;
                margin-bottom: 24px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 12px 24px;
                border-radius: 50px;
                background-color: ${badgeColor};
                color: ${badgeTextColor};
                font-weight: 600;
                font-size: 1rem;
                margin-bottom: 30px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .details-table {
                width: 100%;
                margin-bottom: 30px;
                border-collapse: collapse;
                text-align: left;
            }
            .details-table tr {
                border-bottom: 1px rgba(255,255,255,0.06) solid;
            }
            .details-table td {
                padding: 14px 8px;
                font-size: 0.95rem;
            }
            .details-table td.label {
                color: #94a3b8;
                font-weight: 400;
                width: 40%;
            }
            .details-table td.value {
                color: #ffffff;
                font-weight: 600;
                word-break: break-all;
            }
            .hash-box {
                background: rgba(0,0,0,0.2);
                border: 1px rgba(255,255,255,0.05) solid;
                border-radius: 12px;
                padding: 12px;
                font-family: monospace;
                font-size: 0.75rem;
                color: #38bdf8;
                word-break: break-all;
                text-align: left;
                margin-top: 5px;
            }
            .footer {
                margin-top: 24px;
                font-size: 0.75rem;
                color: #64748b;
                z-index: 1;
                max-width: 400px;
                text-align: center;
                line-height: 1.4;
            }
        </style>
    </head>
    <body>
        <div class="background-glow"></div>
        <div class="card">
            <div class="logo-container">
                <span class="logo-text">${brandName} · SafetyField</span>
            </div>
            
            <h1 class="title">Constancia de Integridad</h1>
            <p class="subtitle">Ecosistema Prevención 4.0</p>
            
            <div class="status-badge">
                ${badgeIcon}
                <span>${badgeText}</span>
            </div>
            
            <table class="details-table">
                <tr>
                    <td class="label">Identificador Público</td>
                    <td class="value">${data.publicId}</td>
                </tr>
                <tr>
                    <td class="label">Entidad Emisora</td>
                    <td class="value">${data.tenant}</td>
                </tr>
                <tr>
                    <td class="label">Fecha de Cierre</td>
                    <td class="value">${dateFormatted}</td>
                </tr>
                <tr>
                    <td class="label">Instalación / Planta</td>
                    <td class="value">${inspection.plant} / ${inspection.sector}</td>
                </tr>
                <tr>
                    <td class="label">Firma Criptográfica</td>
                    <td class="value">
                        <span>SHA-256 de Cierre</span>
                        <div class="hash-box">${data.closingHash}</div>
                    </td>
                </tr>
            </table>
        </div>
        <div class="footer">
            Esta constancia digital verifica de manera pública la integridad y trazabilidad del acta laboral generada, en conformidad con las pautas técnicas de la Res. SRT 48/2025 de la República Argentina.
        </div>
    </body>
    </html>
    `;
}

function renderNotFoundHtml(publicId: string) {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Constancia No Encontrada</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            body {
                font-family: 'Outfit', sans-serif;
                background: #0f172a;
                color: #ffffff;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                text-align: center;
            }
            .card {
                background: #1e293b;
                border: 1px rgba(255,255,255,0.1) solid;
                border-radius: 20px;
                padding: 40px;
                max-width: 450px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            h1 { font-size: 1.5rem; margin-bottom: 12px; color: #f43f5e; }
            p { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; margin-bottom: 20px; }
            .code { font-family: monospace; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; color: #f43f5e; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Constancia No Encontrada</h1>
            <p>El código de verificación <span class="code">${publicId}</span> no corresponde a un acta de inspección registrada o vigente bajo el Ecosistema de Prevención 4.0.</p>
        </div>
    </body>
    </html>
    `;
}
