import PDFDocument from 'pdfkit';
import { InspectionState } from './_types.js';
import { getPhoto } from './_storage.js';
import db from './_db.js';

// ── Colores de marca ──────────────────────────────────────────────────────────
const HSE_GREEN   = '#16a34a';
const HSE_GREEN_L = '#dcfce7'; // fondo claro para secciones
const RISK_COLORS: Record<string, { text: string; bg: string; label: string }> = {
    alto:  { text: '#991b1b', bg: '#fee2e2', label: 'ALTO'  },
    medio: { text: '#92400e', bg: '#fef3c7', label: 'MEDIO' },
    bajo:  { text: '#166534', bg: '#dcfce7', label: 'BAJO'  },
};
const GRAY_LINE  = '#e2e8f0';
const GRAY_TEXT  = '#64748b';
const PAGE_W     = 595.28; // A4 ancho en puntos
const MARGIN     = 50;
const CONTENT_W  = PAGE_W - MARGIN * 2;

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

export async function generateInspectionPDF(inspection: InspectionState): Promise<Buffer> {
    // Resolver foto antes de abrir el stream
    let photoBuffer: Buffer | null = null;
    if (inspection.photoUrl?.startsWith('photo:')) {
        try {
            const photo = await getPhoto(inspection.photoUrl.replace('photo:', ''));
            if (photo) photoBuffer = Buffer.from(photo.data, 'base64');
        } catch { /* PDF se genera igual sin foto */ }
    }

    // Buscar datos de firma del inspector
    const signature = await getInspectorSignature(inspection.operator, inspection.tenantId);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end',  () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── HEADER ───────────────────────────────────────────────────────────
        // Banda verde HSE
        doc.rect(0, 0, PAGE_W, 70).fill(HSE_GREEN);

        // Isotipo HSE: círculo blanco con "hse"
        doc.circle(MARGIN + 20, 35, 20).fill('#ffffff');
        doc.fontSize(10).font('Helvetica-Bold').fillColor(HSE_GREEN)
           .text('hse', MARGIN + 8, 30, { width: 24, align: 'center' });

        // Nombre empresa
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
           .text('HSE INGENIERIA', MARGIN + 50, 18);
        doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.75)')
           .text('Seguridad e Higiene Industrial', MARGIN + 50, 40);

        // SafetyVision a la derecha del header
        doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.6)')
           .text('Powered by SafetyVision AI · Nodo8', 0, 55, { align: 'right', width: PAGE_W - MARGIN });

        doc.moveDown(0);
        doc.y = 85; // posición después del header

        // Título del documento
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a')
           .text('ACTA DE INSPECCIÓN DE SEGURIDAD', MARGIN, doc.y, { align: 'center', width: CONTENT_W });
        doc.moveDown(0.3);

        // Número de inspección y fecha alineados
        const fechaStr = new Date(inspection.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
        doc.fontSize(9).font('Helvetica').fillColor(GRAY_TEXT)
           .text(`Nº ${inspection.inspectionId.substring(0, 8).toUpperCase()}   ·   ${fechaStr}`,
               MARGIN, doc.y, { align: 'center', width: CONTENT_W });
        doc.moveDown(1.2);

        // ── SECCIÓN: DATOS DE LA INSPECCIÓN ──────────────────────────────────
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

        infoRows.forEach(([label, value], i) => {
            const rowY = doc.y;
            if (i % 2 === 0) {
                doc.rect(MARGIN, rowY, CONTENT_W, 18).fill('#f8fafc');
            }
            doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY_TEXT)
               .text(label, MARGIN + 6, rowY + 4, { width: 160, continued: false });
            doc.fontSize(9).font('Helvetica').fillColor('#0f172a')
               .text(value, MARGIN + 170, rowY + 4, { width: CONTENT_W - 170 });
            doc.y = rowY + 18;
        });

        doc.moveDown(1);

        // ── SECCIÓN: RESUMEN DE RIESGOS ──────────────────────────────────────
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

                // Verificar salto de página
                if (doc.y + 70 > doc.page.height - 80) doc.addPage();

                const blockY = doc.y;

                // Fondo de color según nivel
                doc.rect(MARGIN, blockY, CONTENT_W, 62).fill(colors.bg);

                // Borde izquierdo de color
                doc.rect(MARGIN, blockY, 4, 62).fill(colors.text);

                // Badge nivel
                doc.rect(PAGE_W - MARGIN - 54, blockY + 6, 48, 14).fill(colors.text);
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff')
                   .text(colors.label, PAGE_W - MARGIN - 54, blockY + 9,
                       { width: 48, align: 'center' });

                // Número y categoría
                doc.fontSize(8).font('Helvetica-Bold').fillColor(colors.text)
                   .text(`${i + 1}. ${catLabel}`, MARGIN + 10, blockY + 7);

                // Descripción
                doc.fontSize(9).font('Helvetica').fillColor('#1e293b')
                   .text(risk.description, MARGIN + 10, blockY + 20,
                       { width: CONTENT_W - 70, lineBreak: false });

                // Recomendación
                if (risk.recommendation) {
                    doc.fontSize(8).font('Helvetica-Oblique').fillColor(colors.text)
                       .text(`→ ${risk.recommendation}`,
                           MARGIN + 10, blockY + 36,
                           { width: CONTENT_W - 70, lineBreak: false });
                }

                // Confianza IA (discreto)
                doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
                   .text(`Confianza IA: ${risk.confidence}%`,
                       MARGIN + 10, blockY + 50);

                doc.y = blockY + 68;
                doc.moveDown(0.2);
            });
        }

        doc.moveDown(0.8);

        // ── SECCIÓN: PLAN DE ACCIÓN ───────────────────────────────────────────
        if (doc.y + 100 > doc.page.height - 80) doc.addPage();

        sectionHeader(doc, 'PLAN DE ACCIÓN CORRECTIVA');

        const actionRows: [string, string][] = [
            ['Acción requerida', inspection.task.action || '-'],
            ['Responsable',      inspection.task.responsible || '-'],
            ['Plazo máximo',     inspection.task.deadline || '-'],
        ];

        if (inspection.task.resolvedAt) {
            actionRows.push(['Resuelto el', new Date(inspection.task.resolvedAt)
                .toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })]);
            actionRows.push(['Resuelto por', inspection.task.resolvedBy || '-']);
        }

        actionRows.forEach(([label, value], i) => {
            const rowY = doc.y;
            if (i % 2 === 0) doc.rect(MARGIN, rowY, CONTENT_W, 18).fill('#f8fafc');
            doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY_TEXT)
               .text(label, MARGIN + 6, rowY + 4, { width: 160 });
            doc.fontSize(9).font('Helvetica').fillColor('#0f172a')
               .text(value, MARGIN + 170, rowY + 4, { width: CONTENT_W - 170 });
            doc.y = rowY + 18;
        });

        doc.moveDown(1);

        // ── SECCIÓN: EVIDENCIA FOTOGRÁFICA ────────────────────────────────────
        if (photoBuffer) {
            if (doc.y + 220 > doc.page.height - 80) doc.addPage();

            sectionHeader(doc, 'EVIDENCIA FOTOGRÁFICA');
            try {
                doc.image(photoBuffer, {
                    fit: [CONTENT_W, 240],
                    align: 'center',
                });
            } catch {
                doc.fontSize(9).font('Helvetica').fillColor(GRAY_TEXT)
                   .text('(No se pudo incrustar la imagen en este reporte)');
            }
            doc.moveDown(1);
        }

        // ── FIRMA ─────────────────────────────────────────────────────────────
        if (doc.y + 100 > doc.page.height - 80) doc.addPage();
        doc.moveDown(2);

        const firmaX = MARGIN;
        const firmaW = 200;
        const firmaY = doc.y;

        // Caja de firma con borde
        doc.rect(firmaX, firmaY, firmaW, 60).stroke(GRAY_LINE);

        // Línea de firma dentro de la caja
        doc.moveTo(firmaX + 10, firmaY + 28).lineTo(firmaX + firmaW - 10, firmaY + 28).stroke(GRAY_LINE);
        doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
           .text('Firma', firmaX + 10, firmaY + 30);

        // Nombre completo (si está disponible)
        const signatureName = signature?.fullName || inspection.operator;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a')
           .text(signatureName, firmaX + 10, firmaY + 42, { width: firmaW - 20 });

        // Sello: función y matrícula
        const selloLines: string[] = [];
        if (signature?.jobTitle) selloLines.push(signature.jobTitle);
        if (signature?.licenseNumber) selloLines.push(signature.licenseNumber);
        if (selloLines.length === 0) selloLines.push('Inspector de Seguridad');

        // Caja de sello a la derecha de la firma
        const selloX = firmaX + firmaW + 20;
        const selloW = 180;
        doc.rect(selloX, firmaY, selloW, 60).dash(3, { space: 3 }).stroke('#94a3b8');
        doc.undash();

        doc.fontSize(7).font('Helvetica-Bold').fillColor(HSE_GREEN)
           .text('SELLO', selloX + 10, firmaY + 8);
        selloLines.forEach((line, i) => {
            doc.fontSize(8).font('Helvetica').fillColor('#0f172a')
               .text(line, selloX + 10, firmaY + 20 + (i * 13), { width: selloW - 20 });
        });
        doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
           .text('HSE Ingeniería', selloX + 10, firmaY + 48);

        // ── FOOTER en todas las páginas ────────────────────────────────────────
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            // Banda footer
            doc.rect(0, doc.page.height - 36, PAGE_W, 36).fill('#f1f5f9');
            doc.moveTo(0, doc.page.height - 36).lineTo(PAGE_W, doc.page.height - 36).stroke(GRAY_LINE);
            // Texto izquierda
            doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
               .text(
                   `Generado el ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} · HSE Ingeniería`,
                   MARGIN, doc.page.height - 23
               );
            // Texto derecha: página
            doc.fontSize(7).font('Helvetica').fillColor(GRAY_TEXT)
               .text(
                   `Página ${i + 1} de ${totalPages}   ·   SafetyVision AI · Nodo8`,
                   0, doc.page.height - 23,
                   { align: 'right', width: PAGE_W - MARGIN }
               );
        }

        doc.end();
    });
}

// ── Helper: encabezado de sección ─────────────────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_W, 20).fill(HSE_GREEN);
    doc.rect(MARGIN, y, 3, 20).fill('#ffffff');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
       .text(title, MARGIN + 10, y + 5, { width: CONTENT_W - 20 });
    doc.y = y + 24;
}
