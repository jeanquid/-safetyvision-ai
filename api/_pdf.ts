import PDFDocument from 'pdfkit';
import { InspectionState } from './_types.js';
import { getPhoto } from './_storage.js';
import db from './_db.js';

// ── Colores ───────────────────────────────────────────────────────────────────
const HSE_GREEN   = '#16a34a';
const RISK_COLORS: Record<string, { text: string; bg: string; label: string }> = {
    alto:  { text: '#991b1b', bg: '#fee2e2', label: 'ALTO'  },
    medio: { text: '#92400e', bg: '#fef3c7', label: 'MEDIO' },
    bajo:  { text: '#166534', bg: '#dcfce7', label: 'BAJO'  },
};
const GRAY_LINE  = '#e2e8f0';
const GRAY_TEXT  = '#64748b';
const PAGE_W     = 595.28;
const MARGIN     = 50;
const CONTENT_W  = PAGE_W - MARGIN * 2;
const PAGE_H     = 841.89; // A4 alto en puntos
const FOOTER_H   = 50;     // espacio reservado para footer

// ── Helper: espacio disponible en la página ───────────────────────────────────
function spaceLeft(doc: PDFKit.PDFDocument): number {
    return PAGE_H - doc.y - FOOTER_H;
}

// ── Helper: saltar página si no hay espacio ───────────────────────────────────
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    if (spaceLeft(doc) < needed) {
        doc.addPage();
        doc.y = MARGIN;
    }
}

// ── Helper: encabezado de sección ─────────────────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
    ensureSpace(doc, 40);
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_W, 22).fill(HSE_GREEN);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
       .text(title, MARGIN + 10, y + 6, { width: CONTENT_W - 20 });
    doc.y = y + 28;
    doc.fillColor('#000000');
}

// ── Helper: fila de datos (label + valor) ─────────────────────────────────────
function dataRow(doc: PDFKit.PDFDocument, label: string, value: string, index: number): void {
    const textW = CONTENT_W - 180;
    const valueHeight = doc.heightOfString(value, { width: textW, font: 'Helvetica', fontSize: 9 });
    const rowH = Math.max(18, valueHeight + 8);

    ensureSpace(doc, rowH);
    const rowY = doc.y;

    if (index % 2 === 0) {
        doc.rect(MARGIN, rowY, CONTENT_W, rowH).fill('#f8fafc');
    }
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY_TEXT)
       .text(label, MARGIN + 6, rowY + 4, { width: 160 });
    doc.fontSize(9).font('Helvetica').fillColor('#0f172a')
       .text(value, MARGIN + 170, rowY + 4, { width: textW });
    doc.y = rowY + rowH;
    doc.fillColor('#000000');
}

// ── Helper: buscar firma del inspector ────────────────────────────────────────
async function getInspectorSignature(operatorName: string, tenantId: string): Promise<{
    fullName: string | null;
    licenseNumber: string | null;
    jobTitle: string | null;
} | null> {
    try {
        const result = await db.query(
            `SELECT full_name, license_number, job_title
             FROM users
             WHERE tenant_id = $1 AND (display_name = $2 OR full_name = $2)
             LIMIT 1`,
            [tenantId, operatorName]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            fullName: row.full_name || null,
            licenseNumber: row.license_number || null,
            jobTitle: row.job_title || null,
        };
    } catch {
        return null;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERAR PDF
// ══════════════════════════════════════════════════════════════════════════════
export async function generateInspectionPDF(inspection: InspectionState): Promise<Buffer> {
    // Resolver foto
    let photoBuffer: Buffer | null = null;
    if (inspection.photoUrl?.startsWith('photo:')) {
        try {
            const photo = await getPhoto(inspection.photoUrl.replace('photo:', ''));
            if (photo) photoBuffer = Buffer.from(photo.data, 'base64');
        } catch {}
    }

    // Buscar firma del inspector
    const signature = await getInspectorSignature(inspection.operator, inspection.tenantId);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end',  () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── HEADER ────────────────────────────────────────────────────────
        doc.rect(0, 0, PAGE_W, 70).fill(HSE_GREEN);

        // Isotipo HSE
        doc.circle(MARGIN + 20, 35, 20).fill('#ffffff');
        doc.fontSize(10).font('Helvetica-Bold').fillColor(HSE_GREEN)
           .text('hse', MARGIN + 8, 30, { width: 24, align: 'center' });

        // Nombre empresa
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
           .text('HSE INGENIERIA', MARGIN + 50, 18);
        doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.75)')
           .text('Seguridad e Higiene Industrial', MARGIN + 50, 40);

        // SafetyVision a la derecha
        doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
           .text('Powered by SafetyVision AI · Nodo8', 0, 55, { align: 'right', width: PAGE_W - MARGIN });

        // ── TÍTULO ────────────────────────────────────────────────────────
        doc.y = 85;
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a')
           .text('ACTA DE INSPECCIÓN DE SEGURIDAD', MARGIN, doc.y, { align: 'center', width: CONTENT_W });
        doc.moveDown(0.3);

        const fechaStr = new Date(inspection.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
        doc.fontSize(9).font('Helvetica').fillColor(GRAY_TEXT)
           .text(`Nº ${inspection.inspectionId.substring(0, 8).toUpperCase()}   ·   ${fechaStr}`,
               MARGIN, doc.y, { align: 'center', width: CONTENT_W });
        doc.moveDown(1.2);

        // ── DATOS DE LA INSPECCIÓN ────────────────────────────────────────
        sectionHeader(doc, 'DATOS DE LA INSPECCIÓN');

        const infoRows: [string, string][] = [
            ['Empresa inspeccionada', inspection.companyName || '-'],
            ['Planta / Instalación',  inspection.plant],
            ['Sector',                inspection.sector || '-'],
            ['Inspector / Operador',  inspection.operator],
            ['Estado de tarea',       inspection.task.status === 'resuelto'
                ? 'RESUELTA' : inspection.task.status === 'en_progreso'
                ? 'EN PROGRESO' : 'PENDIENTE'],
        ];
        infoRows.forEach(([label, value], i) => dataRow(doc, label, value, i));
        doc.moveDown(1);

        // ── RIESGOS DETECTADOS ────────────────────────────────────────────
        sectionHeader(doc, 'RIESGOS DETECTADOS POR IA');

        if (inspection.risks.length === 0) {
            doc.fontSize(10).font('Helvetica').fillColor(GRAY_TEXT)
               .text('No se detectaron riesgos en esta inspección.', { align: 'center' });
            doc.moveDown(1);
        } else {
            inspection.risks.forEach((risk, i) => {
                const colors = RISK_COLORS[risk.level] || RISK_COLORS.medio;
                const catLabel = risk.category === 'epp' ? 'EPP'
                    : risk.category === 'condiciones' ? 'CONDICIONES'
                    : 'COMPORTAMIENTO';

                // ── Medir alturas de texto ANTES de dibujar ──
                const descW = CONTENT_W - 24;
                const descHeight = doc.heightOfString(risk.description, {
                    width: descW, font: 'Helvetica', fontSize: 9
                });
                const recoHeight = risk.recommendation
                    ? doc.heightOfString(`→ ${risk.recommendation}`, {
                        width: descW, font: 'Helvetica-Oblique', fontSize: 8
                    })
                    : 0;

                // Altura total del bloque: header(18) + desc + reco + confianza(14) + padding(16)
                const blockH = 18 + descHeight + (recoHeight > 0 ? recoHeight + 4 : 0) + 14 + 16;

                // Verificar espacio
                ensureSpace(doc, blockH + 8);

                const blockY = doc.y;

                // Fondo de color según nivel
                doc.rect(MARGIN, blockY, CONTENT_W, blockH).fill(colors.bg);

                // Borde izquierdo
                doc.rect(MARGIN, blockY, 4, blockH).fill(colors.text);

                // Badge nivel (esquina superior derecha)
                doc.rect(PAGE_W - MARGIN - 54, blockY + 4, 48, 14).fill(colors.text);
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
                   .text(colors.label, PAGE_W - MARGIN - 54, blockY + 7,
                       { width: 48, align: 'center' });

                // Número y categoría
                let cursorY = blockY + 5;
                doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.text)
                   .text(`${i + 1}. ${catLabel}`, MARGIN + 10, cursorY);
                cursorY += 18;

                // Descripción (altura dinámica)
                doc.fontSize(9).font('Helvetica').fillColor('#1e293b')
                   .text(risk.description, MARGIN + 10, cursorY, { width: descW });
                cursorY += descHeight + 4;

                // Recomendación (altura dinámica)
                if (risk.recommendation) {
                    doc.fontSize(8).font('Helvetica-Oblique').fillColor(colors.text)
                       .text(`→ ${risk.recommendation}`, MARGIN + 10, cursorY, { width: descW });
                    cursorY += recoHeight + 4;
                }

                // Confianza IA
                doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
                   .text(`Confianza IA: ${risk.confidence}%`, MARGIN + 10, cursorY);

                doc.y = blockY + blockH + 6;
            });
        }

        doc.moveDown(0.8);

        // ── PLAN DE ACCIÓN CORRECTIVA ─────────────────────────────────────
        sectionHeader(doc, 'PLAN DE ACCIÓN CORRECTIVA');

        // Acciones como lista numerada (una por riesgo) en vez de concatenar todo
        inspection.risks.forEach((risk, i) => {
            const actionText = risk.recommendation || risk.description;
            const levelLabel = (RISK_COLORS[risk.level] || RISK_COLORS.medio).label;
            const lineText = `${i + 1}. [${levelLabel}] ${actionText}`;
            const lineH = doc.heightOfString(lineText, { width: CONTENT_W - 12, font: 'Helvetica', fontSize: 8 });

            ensureSpace(doc, lineH + 6);
            const rowY = doc.y;

            if (i % 2 === 0) doc.rect(MARGIN, rowY, CONTENT_W, lineH + 6).fill('#f8fafc');

            const colors = RISK_COLORS[risk.level] || RISK_COLORS.medio;
            doc.fontSize(8).font('Helvetica').fillColor(colors.text)
               .text(lineText, MARGIN + 6, rowY + 3, { width: CONTENT_W - 12 });

            doc.y = rowY + lineH + 6;
        });

        doc.moveDown(0.5);

        // Responsable, plazo, resolución
        const actionMeta: [string, string][] = [
            ['Responsable', inspection.task.responsible || '-'],
            ['Plazo máximo', inspection.task.deadline || '-'],
        ];
        if (inspection.task.resolvedAt) {
            actionMeta.push(['Resuelto el', new Date(inspection.task.resolvedAt)
                .toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })]);
            actionMeta.push(['Resuelto por', inspection.task.resolvedBy || '-']);
        }
        actionMeta.forEach(([label, value], i) => dataRow(doc, label, value, i));
        doc.moveDown(1);

        // ── EVIDENCIA FOTOGRÁFICA ─────────────────────────────────────────
        if (photoBuffer) {
            ensureSpace(doc, 280);
            sectionHeader(doc, 'EVIDENCIA FOTOGRÁFICA');
            try {
                doc.image(photoBuffer, MARGIN, doc.y, {
                    fit: [CONTENT_W, 240],
                    align: 'center',
                });
                doc.y += 250;
            } catch {
                doc.fontSize(9).font('Helvetica').fillColor(GRAY_TEXT)
                   .text('(No se pudo incrustar la imagen en este reporte)');
            }
            doc.moveDown(1);
        }

        // ── FIRMA Y SELLO ─────────────────────────────────────────────────
        ensureSpace(doc, 100);
        doc.moveDown(1.5);

        const firmaX = MARGIN;
        const firmaW = 200;
        const firmaY = doc.y;

        // Caja de firma
        doc.rect(firmaX, firmaY, firmaW, 60).stroke(GRAY_LINE);
        doc.moveTo(firmaX + 10, firmaY + 28).lineTo(firmaX + firmaW - 10, firmaY + 28).stroke(GRAY_LINE);
        doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
           .text('Firma', firmaX + 10, firmaY + 30);

        const signatureName = signature?.fullName || inspection.operator;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a')
           .text(signatureName, firmaX + 10, firmaY + 42, { width: firmaW - 20 });

        // Caja de sello
        const selloX = firmaX + firmaW + 20;
        const selloW = 180;
        doc.save();
        doc.rect(selloX, firmaY, selloW, 60).dash(3, { space: 3 }).stroke('#94a3b8');
        doc.restore();

        doc.fontSize(7).font('Helvetica-Bold').fillColor(HSE_GREEN)
           .text('SELLO', selloX + 10, firmaY + 8);

        const selloLines: string[] = [];
        if (signature?.jobTitle) selloLines.push(signature.jobTitle);
        if (signature?.licenseNumber) selloLines.push(signature.licenseNumber);
        if (selloLines.length === 0) selloLines.push('Inspector de Seguridad');

        selloLines.forEach((line, i) => {
            doc.fontSize(8).font('Helvetica').fillColor('#0f172a')
               .text(line, selloX + 10, firmaY + 20 + (i * 13), { width: selloW - 20 });
        });
        doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
           .text('HSE Ingeniería', selloX + 10, firmaY + 48);

        // ── FOOTER en todas las páginas ────────────────────────────────────
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            // Banda footer
            doc.rect(0, PAGE_H - 36, PAGE_W, 36).fill('#f1f5f9');
            doc.moveTo(0, PAGE_H - 36).lineTo(PAGE_W, PAGE_H - 36).stroke(GRAY_LINE);
            // Izquierda
            doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
               .text(
                   `Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} · HSE Ingeniería`,
                   MARGIN, PAGE_H - 23
               );
            // Derecha
            doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
               .text(
                   `Página ${i + 1} de ${totalPages}   ·   SafetyVision AI · Nodo8`,
                   0, PAGE_H - 23,
                   { align: 'right', width: PAGE_W - MARGIN }
               );
        }

        doc.end();
    });
}
