import sharp from 'sharp';
import { logger } from './_logger.js';

interface CompressionResult {
    base64: string;
    mimeType: string;
    originalSizeKB: number;
    compressedSizeKB: number;
    reductionPct: number;
}

/**
 * Comprime una imagen base64 para optimizar envío a Gemini Vision.
 * Redimensiona a maxWidth manteniendo aspect ratio y convierte a JPEG.
 * 
 * @param base64Data - String base64 SIN prefijo data:...,  (así llega desde el frontend en esta app)
 * @param mimeType - MIME type original (image/jpeg, image/png, etc.)
 * @param maxWidth - Ancho máximo en px (default 1024 — suficiente para Gemini)
 * @param quality - Calidad JPEG 1-100 (default 80 — buen balance calidad/tamaño)
 */
export async function compressImage(
    base64Data: string,
    mimeType: string = 'image/jpeg',
    maxWidth: number = 1024,
    quality: number = 80
): Promise<CompressionResult> {
    try {
        const inputBuffer = Buffer.from(base64Data, 'base64');
        const originalSizeKB = +(inputBuffer.length / 1024).toFixed(1);

        const compressedBuffer = await sharp(inputBuffer)
            .resize(maxWidth, maxWidth, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();

        const compressedSizeKB = +(compressedBuffer.length / 1024).toFixed(1);
        const reductionPct = +((1 - compressedBuffer.length / inputBuffer.length) * 100).toFixed(1);

        logger.info('compress', `Image compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (-${reductionPct}%)`);

        return {
            base64: compressedBuffer.toString('base64'),
            mimeType: 'image/jpeg',
            originalSizeKB,
            compressedSizeKB,
            reductionPct,
        };
    } catch (error: any) {
        logger.warn('compress', `Compression failed, using original: ${error.message}`);
        return {
            base64: base64Data,
            mimeType,
            originalSizeKB: +(Buffer.from(base64Data, 'base64').length / 1024).toFixed(1),
            compressedSizeKB: +(Buffer.from(base64Data, 'base64').length / 1024).toFixed(1),
            reductionPct: 0,
        };
    }
}
