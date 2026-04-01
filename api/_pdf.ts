import PDFDocument from 'pdfkit';
import { InspectionState } from './_types.js';

export function generateInspectionPDF(inspection: InspectionState): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).font('Helvetica-Bold')
           .text('SafetyVision AI', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
           .text('Reporte de Inspección de Seguridad', { align: 'center' });
        doc.moveDown(1.5);

        // Info general
        doc.fontSize(12).font('Helvetica-Bold').text('Datos de la Inspección');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#CCCCCC');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');

        const info = [
            ['ID', inspection.inspectionId.substring(0, 8)],
            ['Fecha', new Date(inspection.createdAt).toLocaleString('es-AR')],
            ['Planta', inspection.plant],
            ['Sector', inspection.sector],
            ['Operador', inspection.operator],
            ['Estado', inspection.task.status.toUpperCase()],
        ];

        info.forEach(([label, value]) => {
            doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
            doc.font('Helvetica').text(value);
        });

        doc.moveDown(1);

        // Riesgos
        doc.fontSize(12).font('Helvetica-Bold').text('Riesgos Detectados');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#CCCCCC');
        doc.moveDown(0.5);

        const levelColors: Record<string, string> = {
            alto: '#DC2626', medio: '#D97706', bajo: '#16A34A'
        };

        inspection.risks.forEach((risk, i) => {
            const color = levelColors[risk.level] || '#666666';
            doc.fontSize(10).font('Helvetica-Bold')
               .fillColor(color)
               .text(`${i + 1}. [${risk.level.toUpperCase()}] ${risk.category.toUpperCase()}`);
            doc.fillColor('#000000').font('Helvetica')
               .text(risk.description);
            if (risk.recommendation) {
                doc.font('Helvetica-Oblique')
                   .text(`→ ${risk.recommendation}`);
            }
            doc.text(`Confianza: ${risk.confidence}% | Modelo: ${risk.aiModel || 'N/A'}`, {
                align: 'right',
            });
            doc.moveDown(0.5);
        });

        doc.moveDown(1);

        // Tarea correctiva
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
           .text('Tarea Correctiva');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#CCCCCC');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        doc.font('Helvetica-Bold').text('Acción: ', { continued: true });
        doc.font('Helvetica').text(inspection.task.action);
        doc.font('Helvetica-Bold').text('Responsable: ', { continued: true });
        doc.font('Helvetica').text(inspection.task.responsible);
        doc.font('Helvetica-Bold').text('Plazo: ', { continued: true });
        doc.font('Helvetica').text(inspection.task.deadline);

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#999999')
           .text(
               `Generado por SafetyVision AI el ${new Date().toLocaleString('es-AR')}`,
               { align: 'center' }
           );

        doc.end();
    });
}
