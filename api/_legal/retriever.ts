import db from '../_db.js';
import { getEmbedding } from '../_ai-engine.js';
import { LegalBasis } from '../_types.js';
import { logger } from '../_logger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';

// Cosine similarity in memory
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Falls back to the configured Gemini model for grounding
 */
async function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    const projectId = process.env.GCP_PROJECT_ID;
    
    if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    if (projectId) {
        const location = process.env.GCP_LOCATION || 'us-central1';
        const keyJson = process.env.GCP_KEY_JSON;
        const options: any = { project: projectId, location };
        if (keyJson) {
            options.googleAuthOptions = { credentials: JSON.parse(keyJson) };
        }
        const vertexAI = new VertexAI(options);
        return vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    return null;
}

export async function retrieveLegalBasis(query: string, tenantId: string): Promise<LegalBasis | null> {
    try {
        logger.info('retriever', `Retrieving legal basis for query: "${query}" under tenant: "${tenantId}"`);
        
        // 1. Obtener embedding de la consulta
        const queryEmbedding = await getEmbedding(query);
        
        // 2. Obtener chunks de la base de datos
        /*
         * FUTURE PGVECTOR MIGRATION ANCHOR (Migración futura a pgvector):
         * Actualmente realizamos la recuperación del corpus legal cargando todos los chunks en memoria
         * y calculando la similitud coseno utilizando JS.
         * Cuando el volumen del corpus normativo crezca significativamente, esto puede volverse ineficiente.
         * Para migrar a pgvector y realizar la búsqueda semántica directamente en la base de datos:
         * 1. Instalar la extensión pgvector en PostgreSQL: `CREATE EXTENSION IF NOT EXISTS vector;`
         * 2. Cambiar el tipo de datos de la columna `embedding` de `JSONB` a `VECTOR(768)`.
         * 3. Realizar la consulta SQL usando operadores de distancia coseno de pgvector:
         *    `SELECT id, norma, article_id, title, content, (embedding <=> $1::vector) AS distance 
         *     FROM legal_chunks WHERE tenant_id = $2 ORDER BY distance ASC LIMIT 3`
         * Esto delegará el cálculo matemático y los índices vectoriales (HNSW / IVFFlat) directamente al motor de base de datos.
         */
        const res = await db.query(
            'SELECT id, norma, article_id, title, content, embedding FROM legal_chunks WHERE tenant_id = $1',
            [tenantId]
        );
        
        if (res.rows.length === 0) {
            logger.warn('retriever', `No legal chunks found for tenant ${tenantId}`);
            return null;
        }
        
        // 3. Calcular similitudes
        const chunksWithScore = res.rows.map(row => {
            const embedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
            const score = cosineSimilarity(queryEmbedding, embedding);
            return {
                id: row.id,
                norma: row.norma,
                articleId: row.article_id,
                title: row.title,
                content: row.content,
                score
            };
        });
        
        // Ordenar por score descendente
        chunksWithScore.sort((a, b) => b.score - a.score);
        
        const bestMatch = chunksWithScore[0];
        logger.info('retriever', `Best match chunk: "${bestMatch.articleId}" with score: ${bestMatch.score.toFixed(4)}`);
        
        // 4. Evaluar umbral
        if (bestMatch.score < 0.55) {
            logger.info('retriever', `Best score ${bestMatch.score.toFixed(4)} is below threshold (0.55). Returning null.`);
            return null;
        }
        
        // 5. Tomar top 3 chunks
        const topChunks = chunksWithScore.slice(0, 3);
        
        // 6. Segundo paso: Grounding con Gemini
        const model = await getGeminiModel();
        if (!model) {
            // Si por alguna razón no podemos iniciar el modelo, devolvemos un fallback basado en el bestMatch
            logger.warn('retriever', 'Could not initialize Gemini model for grounding step. Using fallback.');
            return {
                articleId: bestMatch.articleId,
                norma: formatNormName(bestMatch.norma),
                citation: bestMatch.content.substring(0, 197) + '...',
                relevance: bestMatch.score
            };
        }
        
        const formattedChunks = topChunks.map((c, idx) => 
            `[Candidato ${idx + 1}] ID: "${c.articleId}", Norma: "${c.norma}", Título: "${c.title}"\nContenido: "${c.content}"`
        ).join('\n\n');
        
        const prompt = `Dada la descripción de un riesgo de seguridad laboral detectado y una lista de artículos normativos de Higiene y Seguridad de la República Argentina, determiná cuál es el artículo aplicable que fundamenta el incumplimiento.
Riesgo detectado: "${query}"

Artículos normativos candidatos:
${formattedChunks}

Deberás elegir el artículo más relevante. Si ninguno de los artículos provistos se relaciona o es relevante para el riesgo detectado, respondé estrictamente "null".
Si encontrás una correspondencia clara, respondé ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues bloques de código markdown \`\`\`json ni texto explicativo extra, solo el objeto JSON de una sola línea):
{ "articleId": "id-del-articulo-elegido", "norma": "nombre-simplificado-de-la-norma", "citation": "breve paráfrasis explicativa en español, máximo 200 caracteres, indicando la obligación incumplida", "relevance": 0.95 }
Asegúrate de que el campo "relevance" sea un número entre 0 y 1 representando qué tan exacto es el match.`;

        const result = await model.generateContent(prompt);
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || (result.response as any).text?.() || '';
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        if (cleaned === 'null' || cleaned === '"null"' || !cleaned) {
            logger.info('retriever', 'Gemini returned null grounding relevance.');
            return null;
        }
        
        try {
            const parsed = JSON.parse(cleaned);
            if (parsed && parsed.articleId) {
                return {
                    articleId: parsed.articleId,
                    norma: parsed.norma || formatNormName(bestMatch.norma),
                    citation: (parsed.citation || '').substring(0, 200),
                    relevance: parsed.relevance || bestMatch.score
                };
            }
        } catch (jsonErr: any) {
            logger.error('retriever', 'Failed to parse Gemini grounding JSON response', { response: cleaned, error: jsonErr.message });
        }
        
        // Fallback si falla el parseo
        return {
            articleId: bestMatch.articleId,
            norma: formatNormName(bestMatch.norma),
            citation: bestMatch.content.substring(0, 197) + '...',
            relevance: bestMatch.score
        };
    } catch (err: any) {
        logger.error('retriever', 'Failed to retrieve legal basis', { error: err.message });
        return null;
    }
}

function formatNormName(filename: string): string {
    if (filename.includes('ley-19587')) return 'Ley 19.587';
    if (filename.includes('decreto-351-79')) return 'Decreto 351/79';
    if (filename.includes('resolucion-srt-900-15')) return 'Res. SRT 900/15';
    if (filename.includes('prevencion-4.0')) return 'Res. SRT 48/25 (Prevención 4.0)';
    return filename;
}
