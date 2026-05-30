import db from './_db.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';

import { createHash } from 'crypto';

export async function savePhoto(
    inspectionId: string,
    base64Data: string,
    mimeType: string,
    width?: number,
    height?: number
): Promise<{ photoId: string; hash: string; width?: number; height?: number }> {
    const photoId = uuidv4();
    const hash = createHash('sha256').update(base64Data).digest('hex');

    let finalWidth = width;
    let finalHeight = height;

    if (!finalWidth || !finalHeight) {
        try {
            const sharp = (await import('sharp')).default;
            const meta = await sharp(Buffer.from(base64Data, 'base64')).metadata();
            finalWidth = meta.width;
            finalHeight = meta.height;
        } catch (err: any) {
            logger.warn('storage', 'Could not extract photo dimensions', { error: err.message });
        }
    }

    await db.query(
        'INSERT INTO photos (photo_id, inspection_id, mime_type, data, photo_hash, width, height) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [photoId, inspectionId, mimeType, base64Data, hash, finalWidth || null, finalHeight || null]
    );

    logger.info('storage', 'Photo saved', { photoId, inspectionId, hash, width: finalWidth, height: finalHeight });
    return { photoId, hash, width: finalWidth, height: finalHeight };
}

export async function getPhoto(photoId: string): Promise<{
    mimeType: string;
    data: string;
    width?: number;
    height?: number;
} | null> {
    const result = await db.query(
        'SELECT mime_type, data, width, height FROM photos WHERE photo_id = $1',
        [photoId]
    );
    if (result.rows.length === 0) return null;
    return {
        mimeType: result.rows[0].mime_type,
        data: result.rows[0].data,
        width: result.rows[0].width || undefined,
        height: result.rows[0].height || undefined,
    };
}
