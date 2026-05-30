import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEmbedding } from '../_ai-engine.js';
import db from '../_db.js';
import { logger } from '../_logger.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIngest() {
    logger.info('ingest', 'Starting legal corpus ingest...');
    const corpusDir = path.join(__dirname, 'corpus');
    
    if (!fs.existsSync(corpusDir)) {
        logger.error('ingest', `Corpus directory not found at ${corpusDir}`);
        process.exit(1);
    }
    
    const tenantsToSeed = ['ensi', 'sv-demo'];

    try {
        await db.query('DELETE FROM legal_chunks');
        logger.info('ingest', 'Cleared existing chunks in legal_chunks');

        const files = fs.readdirSync(corpusDir);
        
        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            
            const filePath = path.join(corpusDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const parts = content.split('<!-- chunk-id:');
            
            const filenameNoExt = file.replace('.md', '');
            
            logger.info('ingest', `Processing file ${file} - found ${parts.length - 1} chunks`);
            
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                const match = part.match(/^\s*([a-zA-Z0-9_\-\.]+)\s*-->([\s\S]*)$/);
                
                if (match) {
                    const articleId = match[1].trim();
                    const chunkContent = match[2].trim();
                    const lines = chunkContent.split('\n');
                    const title = lines[0].replace(/^#+\s*/, '').trim();
                    
                    logger.info('ingest', `Generating embedding for chunk "${articleId}"...`);
                    
                    const embedding = await getEmbedding(chunkContent);
                    
                    for (const tenantId of tenantsToSeed) {
                        const id = uuidv4();
                        await db.query(`
                            INSERT INTO legal_chunks (id, norma, article_id, title, content, embedding, tenant_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `, [
                            id,
                            filenameNoExt,
                            articleId,
                            title,
                            chunkContent,
                            JSON.stringify(embedding),
                            tenantId
                        ]);
                    }
                    logger.info('ingest', `Successfully saved chunk "${articleId}" for tenants ${tenantsToSeed.join(', ')}`);
                }
            }
        }
        logger.info('ingest', '🎉 Legal corpus ingest completed successfully!');
        process.exit(0);
    } catch (err: any) {
        logger.error('ingest', 'Ingest failed', { error: err.message });
        process.exit(1);
    }
}

void runIngest();
