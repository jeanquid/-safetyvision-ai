import db from './_db.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';

export async function savePhoto(
    inspectionId: string,
    base64Data: string,
    mimeType: string
): Promise<string> {
    const photoId = uuidv4();

    await db.query(
        'INSERT INTO photos (photo_id, inspection_id, mime_type, data) VALUES ($1, $2, $3, $4)',
        [photoId, inspectionId, mimeType, base64Data]
    );

    logger.info('storage', 'Photo saved', { photoId, inspectionId });
    return photoId;
}

export async function getPhoto(photoId: string): Promise<{
    mimeType: string;
    data: string;
} | null> {
    const result = await db.query(
        'SELECT mime_type, data FROM photos WHERE photo_id = $1',
        [photoId]
    );
    if (result.rows.length === 0) return null;
    return {
        mimeType: result.rows[0].mime_type,
        data: result.rows[0].data,
    };
}
