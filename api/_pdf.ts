import PDFDocument from 'pdfkit';
import { InspectionState, DetectedRisk, AuditEntry, LegalBasis, deriveLevelFromScore } from './_types.js';
import { getPhoto } from './_storage.js';
import db from './_db.js';
import { qrcodegen } from './_inspections/qrcodegen.js';

// ── Colores ───────────────────────────────────────────────────────────────────
const HSE_GREEN   = '#16a34a';
const ENSI_BLUE   = '#003A70';
const ENSI_ACCENT = '#005FA3';
const IS_ENSI_PDF = process.env.TENANT === 'ensi';
const BRAND_COLOR = IS_ENSI_PDF ? ENSI_BLUE : HSE_GREEN;
const RISK_COLORS: Record<string, { text: string; bg: string; label: string }> = {
    alto:  { text: '#991b1b', bg: '#fee2e2', label: 'ALTO'  },
    medio: { text: '#92400e', bg: '#fef3c7', label: 'MEDIO' },
    bajo:  { text: '#166534', bg: '#dcfce7', label: 'BAJO'  },
};
const GRAY_LINE = '#e2e8f0';
const GRAY_TEXT  = '#64748b';
const PAGE_W     = 595.28;
const PAGE_H     = 841.89;
const M          = 50;        // margin
const CW         = PAGE_W - M * 2; // content width
const BOTTOM     = PAGE_H - 50;    // no escribir debajo de esto

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mide la altura de un texto. IMPORTANTE: setea font/fontSize en el doc antes de medir. */
function measureText(doc: PDFKit.PDFDocument, text: string, font: string, size: number, width: number): number {
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width });
}

/** Si no hay espacio suficiente, salta de página. */
function needSpace(doc: PDFKit.PDFDocument, h: number): void {
    if (doc.y + h > BOTTOM) {
        doc.addPage();
        doc.y = M;
    }
}

/** Dibuja un encabezado de sección con color de brand */
function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    needSpace(doc, 30);
    const y = doc.y;
    doc.rect(M, y, CW, 22).fill(BRAND_COLOR);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
       .text(title, M + 10, y + 6, { width: CW - 20 });
    doc.fillColor('#000000');
    doc.y = y + 28;
}

/** Dibuja una fila label:valor con fondo alterno */
function infoRow(doc: PDFKit.PDFDocument, label: string, value: string, idx: number): void {
    const valW = CW - 180;
    const valH = measureText(doc, value, 'Helvetica', 9, valW);
    const rowH = Math.max(20, valH + 10);
    needSpace(doc, rowH);
    const y = doc.y;
    if (idx % 2 === 0) doc.rect(M, y, CW, rowH).fill('#f8fafc');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY_TEXT)
       .text(label, M + 8, y + 5, { width: 160 });
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a')
       .text(value, M + 172, y + 5, { width: valW });
    doc.fillColor('#000000');
    doc.y = y + rowH;
}

/** Buscar firma del inspector */
async function getSignature(name: string, tid: string) {
    try {
        const r = await db.query(
            `SELECT full_name, license_number, job_title FROM users
             WHERE tenant_id = $1 AND (display_name = $2 OR full_name = $2) LIMIT 1`,
            [tid, name]
        );
        if (r.rows.length === 0) return null;
        return { fullName: r.rows[0].full_name, license: r.rows[0].license_number, title: r.rows[0].job_title };
    } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════════════════
export async function generateInspectionPDF(inspection: InspectionState, host?: string): Promise<Buffer> {
    // Buscar publicId si la inspección tiene una constancia de validez
    let publicId: string | undefined;
    try {
        const complianceRes = await db.query(
            'SELECT public_id FROM compliance_records WHERE inspection_id = $1',
            [inspection.inspectionId]
        );
        if (complianceRes.rows.length > 0) {
            publicId = complianceRes.rows[0].public_id;
        } else if (inspection.status === 'closed') {
            const { ensureComplianceRecord } = await import('./_inspections/compliance.js');
            const lastSeal = inspection.auditTrail.length > 0
                ? inspection.auditTrail[inspection.auditTrail.length - 1].seal
                : '0000000000000000000000000000000000000000000000000000000000000000';
            publicId = await ensureComplianceRecord(inspection.inspectionId, inspection.tenantId, lastSeal);
        }
    } catch {}

    // Resolver foto
    let photoBuffer: Buffer | null = null;
    if (inspection.photoUrl?.startsWith('photo:')) {
        try {
            const p = await getPhoto(inspection.photoUrl.replace('photo:', ''));
            if (p) photoBuffer = Buffer.from(p.data, 'base64');
        } catch {}
    }

    const sig = await getSignature(inspection.operator, inspection.tenantId);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ═══════════════════════════════════════════════════════════════════
        // HEADER
        // ═══════════════════════════════════════════════════════════════════
        doc.rect(0, 0, PAGE_W, 70).fill(BRAND_COLOR);
        if (IS_ENSI_PDF) {
            // Rectángulo con texto ENSI
            doc.rect(M, 18, 54, 22).fill('#ffffff');
            doc.font('Helvetica-Bold').fontSize(14).fillColor(ENSI_BLUE)
               .text('ENSI', M + 3, 23, { width: 48, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff')
               .text('ENSI SafetyField', M + 65, 16);
            doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.75)')
               .text('Empresa Neuquina de Servicios de Ingeniería S.E.', M + 65, 37);
            doc.font('Helvetica').fontSize(7).fillColor('rgba(255,255,255,0.6)')
               .text('Powered by SafetyVision AI · Nodo8', 0, 55, { align: 'right', width: PAGE_W - M });
        } else {
            doc.circle(M + 20, 35, 20).fill('#ffffff');
            doc.font('Helvetica-Bold').fontSize(10).fillColor(HSE_GREEN)
               .text('hse', M + 8, 30, { width: 24, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
               .text('HSE INGENIERIA', M + 50, 18);
            doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.75)')
               .text('Seguridad e Higiene Industrial', M + 50, 40);
            doc.font('Helvetica').fontSize(7).fillColor('rgba(255,255,255,0.6)')
               .text('Powered by SafetyVision AI · Nodo8', 0, 55, { align: 'right', width: PAGE_W - M });
        }

        // ═══════════════════════════════════════════════════════════════════
        // TÍTULO
        // ═══════════════════════════════════════════════════════════════════
        doc.y = 85;
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a')
           .text(IS_ENSI_PDF ? 'ACTA DE INSPECCIÓN DE CAMPO' : 'ACTA DE INSPECCIÓN DE SEGURIDAD', M, doc.y, { align: 'center', width: CW });
        if (IS_ENSI_PDF) {
            doc.moveDown(0.15);
            doc.font('Helvetica').fontSize(8).fillColor(GRAY_TEXT)
               .text('Registro de Seguridad e Higiene Laboral — Sector O&G', M, doc.y, { align: 'center', width: CW });
        }
        doc.moveDown(0.3);
        const fecha = new Date(inspection.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
        doc.font('Helvetica').fontSize(9).fillColor(GRAY_TEXT)
           .text(`Nº ${inspection.inspectionId.substring(0, 8).toUpperCase()}   ·   ${fecha}`,
               M, doc.y, { align: 'center', width: CW });
        doc.moveDown(1.2);
        doc.fillColor('#000000');

        // ═══════════════════════════════════════════════════════════════════
        // DATOS DE LA INSPECCIÓN
        // ═══════════════════════════════════════════════════════════════════
        sectionTitle(doc, 'DATOS DE LA INSPECCIÓN');
        const rows: [string, string][] = [
            ['Empresa inspeccionada', inspection.companyName || '-'],
            ['Planta / Instalación', inspection.plant],
            ['Sector', inspection.sector || '-'],
            ['Inspector / Operador', inspection.operator],
            ['Estado de tarea', inspection.task.status === 'resuelto' ? 'RESUELTA'
                : inspection.task.status === 'en_progreso' ? 'EN PROGRESO' : 'PENDIENTE'],
        ];
        rows.forEach(([l, v], i) => infoRow(doc, l, v, i));
        doc.moveDown(1);

        // ═══════════════════════════════════════════════════════════════════
        // RIESGOS DETECTADOS
        // ═══════════════════════════════════════════════════════════════════
        sectionTitle(doc, 'RIESGOS DETECTADOS POR IA');

        if (inspection.risks.length === 0) {
            doc.font('Helvetica').fontSize(10).fillColor(GRAY_TEXT)
               .text('No se detectaron riesgos en esta inspección.', M, doc.y, { width: CW, align: 'center' });
            doc.moveDown(1);
        }

        const textW = CW - 24; // ancho disponible para texto dentro del bloque

        inspection.risks.forEach((risk, i) => {
            const colors = RISK_COLORS[risk.level] || RISK_COLORS.medio;
            const catLabel = risk.category === 'epp' ? 'EPP'
                : risk.category === 'condiciones' ? 'CONDICIONES' : 'COMPORTAMIENTO';

            // ── Medir alturas (seteando font/size ANTES de medir) ──
            const descH = measureText(doc, risk.description, 'Helvetica', 9, textW);
            const recoH = risk.recommendation
                ? measureText(doc, `→ ${risk.recommendation}`, 'Helvetica-Oblique', 8, textW)
                : 0;

            const legalBasisText = risk.legalBasis
                ? `Fundamento: ${risk.legalBasis.norma} · Art. ${risk.legalBasis.articleId} - ${risk.legalBasis.citation}`
                : '';
            const legalH = legalBasisText
                ? measureText(doc, legalBasisText, 'Helvetica', 8, textW)
                : 0;

            const assessmentH = risk.assessment ? 75 : 0;

            // Altura total: header(20) + desc + gap(4) + reco + gap(4) + legal + gap(4) + assessment + gap(4) + confianza(12) + padding(12)
            const blockH = 20 + descH + 4 + (recoH > 0 ? recoH + 4 : 0) + (legalH > 0 ? legalH + 4 : 0) + (assessmentH > 0 ? assessmentH + 4 : 0) + 12 + 12;

            // Saltar página si no hay espacio
            needSpace(doc, blockH + 8);
            const blockY = doc.y;

            // ── Dibujar fondo con altura exacta ──
            doc.rect(M, blockY, CW, blockH).fill(colors.bg);
            doc.rect(M, blockY, 4, blockH).fill(colors.text); // borde izquierdo

            // Badge nivel (esquina superior derecha)
            doc.rect(PAGE_W - M - 54, blockY + 4, 48, 14).fill(colors.text);
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff')
               .text(colors.label, PAGE_W - M - 54, blockY + 7, { width: 48, align: 'center' });

            // Número y categoría
            let cy = blockY + 6;
            doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.text)
               .text(`${i + 1}. ${catLabel}`, M + 10, cy);
            cy += 20;

            // Descripción
            doc.font('Helvetica').fontSize(9).fillColor('#1e293b')
               .text(risk.description, M + 10, cy, { width: textW });
            cy += descH + 4;

            // Recomendación
            if (risk.recommendation) {
                doc.font('Helvetica-Oblique').fontSize(8).fillColor(colors.text)
                   .text(`→ ${risk.recommendation}`, M + 10, cy, { width: textW });
                cy += recoH + 4;
            }

            // Fundamento Normativo RAG
            if (legalBasisText) {
                doc.font('Helvetica').fontSize(8).fillColor('#475569')
                   .text(legalBasisText, M + 10, cy, { width: textW });
                cy += legalH + 4;
            }

            // Matriz de Riesgo 5x5
            if (risk.assessment) {
                const startX = M + 10;
                const startY = cy;
                const cellSize = 11;
                
                // Dibujar etiquetas de ejes
                doc.font('Helvetica-Bold').fontSize(6).fillColor('#64748b')
                   .text('P', startX - 8, startY + 20);
                
                doc.font('Helvetica-Bold').fontSize(6).fillColor('#64748b')
                   .text('C', startX + 25, startY + 5 * cellSize + 2);
                
                for (let p = 5; p >= 1; p--) {
                    for (let c = 1; c <= 5; c++) {
                        const cellX = startX + (c - 1) * cellSize;
                        const cellY = startY + (5 - p) * cellSize;
                        const score = p * c;
                        const lvl = deriveLevelFromScore(score);
                        
                        let bg = '#A7F3D0'; // bajo
                        if (lvl === 'medio') bg = '#FDE68A';
                        if (lvl === 'alto') bg = '#FCA5A5';
                        
                        doc.rect(cellX, cellY, cellSize, cellSize).fill(bg);
                        doc.rect(cellX, cellY, cellSize, cellSize).stroke('#e2e8f0');
                        
                        if (p === risk.assessment.probability && c === risk.assessment.consequence) {
                            doc.save();
                            doc.lineWidth(1.5).strokeColor('#0f172a');
                            doc.rect(cellX, cellY, cellSize, cellSize).stroke();
                            doc.circle(cellX + cellSize / 2, cellY + cellSize / 2, 2.5).fill('#0f172a');
                            doc.restore();
                        }
                    }
                }
                
                const infoX = startX + 5 * cellSize + 15;
                const infoW = textW - (5 * cellSize + 15);
                
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b')
                   .text(`Evaluación Asistida: ${risk.assessment.level.toUpperCase()} (P:${risk.assessment.probability} x C:${risk.assessment.consequence} = ${risk.assessment.score})`, infoX, startY);
                
                const sourceText = risk.assessment.source === 'ai' 
                    ? `Sugerido por IA (${risk.aiModel || 'Gemini'})` 
                    : `Confirmado por Inspector (ID: ${risk.assessment.confirmedBy || 'Usuario'})`;
                    
                doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#475569')
                   .text(sourceText, infoX, startY + 11);
                   
                let justText = '';
                if (risk.assessment.probabilityJustification) {
                    justText += `P: ${risk.assessment.probabilityJustification} `;
                }
                if (risk.assessment.consequenceJustification) {
                    justText += `C: ${risk.assessment.consequenceJustification}`;
                }
                
                if (justText) {
                    doc.font('Helvetica').fontSize(7).fillColor('#64748b')
                       .text(justText.substring(0, 160) + (justText.length > 160 ? '...' : ''), infoX, startY + 22, { width: infoW, height: 35 });
                }
                
                cy += assessmentH + 4;
            }

            // Confianza IA
            doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
               .text(`Confianza IA: ${risk.confidence}%`, M + 10, cy);

            // Mover cursor DESPUÉS del bloque (siempre correcto)
            doc.fillColor('#000000');
            doc.y = blockY + blockH + 6;
        });

        doc.moveDown(0.8);

        // ═══════════════════════════════════════════════════════════════════
        // PLAN DE ACCIÓN (lista numerada)
        // ═══════════════════════════════════════════════════════════════════
        sectionTitle(doc, 'PLAN DE ACCIÓN CORRECTIVA');

        inspection.risks.forEach((risk, i) => {
            const colors = RISK_COLORS[risk.level] || RISK_COLORS.medio;
            const actionText = `${i + 1}. [${colors.label}] ${risk.recommendation || risk.description}`;
            const lineH = measureText(doc, actionText, 'Helvetica', 8, CW - 16);
            const rowH = lineH + 8;

            needSpace(doc, rowH);
            const ry = doc.y;
            if (i % 2 === 0) doc.rect(M, ry, CW, rowH).fill('#f8fafc');

            doc.font('Helvetica').fontSize(8).fillColor(colors.text)
               .text(actionText, M + 8, ry + 4, { width: CW - 16 });

            doc.fillColor('#000000');
            doc.y = ry + rowH;
        });

        doc.moveDown(0.5);

        // Responsable, plazo, resolución
        const metaRows: [string, string][] = [
            ['Responsable', inspection.task.responsible || '-'],
            ['Plazo máximo', inspection.task.deadline || '-'],
        ];
        if (inspection.task.resolvedAt) {
            metaRows.push(['Resuelto el', new Date(inspection.task.resolvedAt)
                .toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })]);
            metaRows.push(['Resuelto por', inspection.task.resolvedBy || '-']);
        }
        metaRows.forEach(([l, v], i) => infoRow(doc, l, v, i));
        doc.moveDown(1);

        // ═══════════════════════════════════════════════════════════════════
        // EVIDENCIA FOTOGRÁFICA
        // ═══════════════════════════════════════════════════════════════════
        if (photoBuffer) {
            needSpace(doc, 290);
            sectionTitle(doc, 'EVIDENCIA FOTOGRÁFICA');
            try {
                doc.image(photoBuffer, M, doc.y, { fit: [CW, 240], align: 'center' });
                doc.y += 250;
            } catch {
                doc.font('Helvetica').fontSize(9).fillColor(GRAY_TEXT)
                   .text('(No se pudo incrustar la imagen)', M, doc.y);
            }
            doc.moveDown(1);
        }

        // ═══════════════════════════════════════════════════════════════════
        // FIRMA Y SELLO
        // ═══════════════════════════════════════════════════════════════════
        needSpace(doc, 90);
        doc.moveDown(1);
        const fy = doc.y;

        // Caja firma
        doc.rect(M, fy, 160, 60).stroke(GRAY_LINE);
        doc.moveTo(M + 10, fy + 30).lineTo(M + 150, fy + 30).stroke(GRAY_LINE);
        doc.font('Helvetica').fontSize(7).fillColor(GRAY_TEXT)
           .text('Firma', M + 10, fy + 32);
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
           .text(sig?.fullName || inspection.operator, M + 10, fy + 44, { width: 140 });

        // Caja sello
        const sx = M + 175;
        doc.save();
        doc.rect(sx, fy, 160, 60).dash(3, { space: 3 }).stroke('#94a3b8');
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(7).fillColor(BRAND_COLOR)
           .text('SELLO', sx + 10, fy + 8);
        const selloLines: string[] = [];
        if (sig?.title) selloLines.push(sig.title);
        if (sig?.license) selloLines.push(sig.license);
        if (selloLines.length === 0) selloLines.push('Inspector de Seguridad');
        selloLines.forEach((line, j) => {
            doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
               .text(line, sx + 10, fy + 20 + (j * 13), { width: 140 });
        });
        doc.font('Helvetica').fontSize(7).fillColor(GRAY_TEXT)
           .text(IS_ENSI_PDF ? 'ENSI S.E.' : 'HSE Ingeniería', sx + 10, fy + 48);

        // Caja QR de Verificación
        const qrx = M + 350;
        doc.rect(qrx, fy, 145, 60).stroke(GRAY_LINE);
        doc.font('Helvetica-Bold').fontSize(6).fillColor(BRAND_COLOR)
           .text('VERIFICACIÓN DIGITAL', qrx + 6, fy + 8, { width: 85 });

        if (publicId) {
            doc.font('Helvetica').fontSize(5).fillColor(GRAY_TEXT)
               .text('Acta digital inmutable firmada en conformidad con la Res. SRT 48/2025.', qrx + 6, fy + 16, { width: 85 });
            doc.font('Helvetica-Bold').fontSize(5).fillColor(GRAY_TEXT)
               .text(`ID: ${publicId.substring(0, 12)}...`, qrx + 6, fy + 48, { width: 85 });

            const appHost = host || process.env.APP_HOST || 'safetyfield.ensi.com.ar';
            const url = `https://${appHost}/verify/${publicId}`;
            try {
                const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
                const qrSize = qr.size;
                const moduleSize = 42 / qrSize; // QR code fits in 42x42 pt
                const qrStartX = qrx + 95;
                const qrStartY = fy + 9;

                doc.fillColor('#000000');
                for (let y = 0; y < qrSize; y++) {
                    for (let x = 0; x < qrSize; x++) {
                        if (qr.getModule(x, y)) {
                            doc.rect(qrStartX + x * moduleSize, qrStartY + y * moduleSize, moduleSize, moduleSize).fill();
                        }
                    }
                }
            } catch (qrErr) {
                // No-op
            }
        } else {
            doc.font('Helvetica').fontSize(5).fillColor(GRAY_TEXT)
               .text('Constancia digital de validez disponible al cerrar la inspección.', qrx + 6, fy + 16, { width: 133 });
        }

        // ═══════════════════════════════════════════════════════════════════
        // FOOTER en todas las páginas
        // ═══════════════════════════════════════════════════════════════════
        doc.fillColor('#000000');
        const range = doc.bufferedPageRange();
        const total = range.count;
        for (let i = 0; i < total; i++) {
            doc.switchToPage(i);
            // Limpiar zona de footer
            doc.rect(0, PAGE_H - 36, PAGE_W, 36).fill('#f1f5f9');
            doc.moveTo(0, PAGE_H - 36).lineTo(PAGE_W, PAGE_H - 36).stroke(GRAY_LINE);
            if (IS_ENSI_PDF) {
                doc.font('Helvetica').fontSize(7).fillColor(GRAY_TEXT)
                   .text(
                       `ENSI S.E. · Ruta 237 – Km. 1278, Arroyito, Neuquén · Reg. Prov. N° 109/20 · IRAM 301-ISO 17025`,
                       M, PAGE_H - 23
                   );
                doc.font('Helvetica').fontSize(7).fillColor(GRAY_TEXT)
                   .text(
                       `Página ${i + 1} de ${total}   ·   Generado por SafetyField · Powered by Nodo8`,
                       0, PAGE_H - 23,
                       { align: 'right', width: PAGE_W - M }
                   );
            } else {
                doc.font('Helvetica').fontSize(7).fillColor(GRAY_TEXT)
                   .text(
                       `Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} · HSE Ingeniería`,
                       M, PAGE_H - 23
                   );
                doc.font('Helvetica').fontSize(7).fillColor(GRAY_TEXT)
                   .text(
                       `Página ${i + 1} de ${total}   ·   SafetyVision AI · Nodo8`,
                       0, PAGE_H - 23,
                       { align: 'right', width: PAGE_W - M }
                   );
            }
        }

        doc.end();
    });
}
