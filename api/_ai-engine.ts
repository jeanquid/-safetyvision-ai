import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import { DetectedRisk, RiskLevel, RiskCategory } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';

const MODELS_FALLBACK = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
];

/**
 * Retorna un modelo configurado, ya sea de Vertex AI o de Google AI Studio.
 */
function getModel(modelName: string) {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || 'us-central1';
    const apiKey = process.env.GEMINI_API_KEY;

    if (projectId) {
        // Usar Vertex AI (GCP)
        const vertexAI = new VertexAI({ project: projectId, location });
        return vertexAI.getGenerativeModel({ model: modelName });
    } else if (apiKey) {
        // Usar Google AI Studio
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: modelName });
    } else {
        throw new Error('No AI configuration found (GEMINI_API_KEY or GCP_PROJECT_ID required)');
    }
}

function sanitizeInput(text: string): string {
    if (!text) return '';
    return text
        .replace(/```/g, '')
        .replace(/\{[^}]*\}/g, '')
        .substring(0, 1000)
        .trim();
}

const VALIDATION_PROMPT = `Observá esta imagen y respondé ÚNICAMENTE con un JSON:
{ "isIndustrial": true/false, "reason": "breve explicación" }

Criterio: ¿La imagen muestra un entorno laboral, industrial, obra, planta, taller, almacén, o zona de trabajo?
Si es una selfie, captura de pantalla, documento, paisaje, o imagen no laboral, respondé false.
Respondé SOLO el JSON, sin markdown.`;

export async function validateImage(
    imageBase64: string,
    mimeType: string
): Promise<{ valid: boolean; reason: string }> {
    try {
        const model = getModel('gemini-2.0-flash');
        
        // El formato de entrada es compatible entre ambos SDKs en las versiones recientes
        const result = await model.generateContent([
            { text: VALIDATION_PROMPT },
            { inlineData: { mimeType, data: imageBase64 } }
        ]);
        
        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';
        
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
            valid: parsed.isIndustrial === true,
            reason: parsed.reason || '',
        };
    } catch (error: any) {
        logger.warn('ai', 'Validation failed (fail-open)', { error: error.message });
        return { valid: true, reason: 'Validation skipped' };
    }
}

const SYSTEM_PROMPT = `Eres un experto en seguridad e higiene industrial certificado, con conocimiento de:
- Normativa argentina: Ley 19.587, Decreto 351/79, Res. SRT 295/03
- Normas IRAM de EPP (IRAM 3620 cascos, IRAM 3622 calzado, etc.)
- ISO 45001 (Sistemas de gestión de SST)
- OSHA 29 CFR 1926 (construcción) y 1910 (industria general)

Tu tarea: Analizar la imagen y detectar TODOS los riesgos de seguridad visibles.

Para cada riesgo detectado, devolvé un objeto JSON con:
- category: "epp" | "condiciones" | "comportamiento"
- description: Descripción clara, específica y profesional del riesgo en español.
- level: "alto" | "medio" | "bajo"
- confidence: Número entre 60 y 99 indicando tu confianza en la detección
- recommendation: Una acción correctiva concreta y específica

Respondé ÚNICAMENTE con un JSON válido:
{ "risks": [ { "category": "...", "description": "...", "level": "...", "confidence": 85, "recommendation": "..." } ] }`;

export async function analyzeImageWithGemini(
    imageBase64: string,
    mimeType: string,
    context?: { plant?: string; sector?: string }
): Promise<{ risks: DetectedRisk[]; model: string; rawResponse: string }> {
    let lastError: Error | null = null;

    for (const modelName of MODELS_FALLBACK) {
        try {
            logger.info('ai', 'Trying model', { model: modelName });
            const model = getModel(modelName);

            const contextInfo = context
                ? `\nContexto: Planta "${context.plant || 'N/A'}", Sector "${context.sector || 'N/A'}"`
                : '';

            const result = await (model as any).generateContent([
                { text: SYSTEM_PROMPT + contextInfo },
                {
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: imageBase64
                    }
                }
            ]);

            const response = result.response;
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';
            
            logger.info('ai', 'Model response received', { model: modelName, preview: text.substring(0, 50) });

            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);

            const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => ({
                id: uuidv4(),
                category: validateCategory(r.category),
                description: r.description || 'Riesgo detectado',
                level: validateLevel(r.level),
                confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                recommendation: r.recommendation,
                status: 'pendiente' as const,
                aiModel: modelName,
            }));

            return { risks, model: modelName, rawResponse: text };
        } catch (err: any) {
            logger.warn('ai', 'Model failed, trying fallback', { model: modelName, error: err.message });
            lastError = err;
            continue;
        }
    }

    throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
}

export async function analyzeTextDescription(
    description: string,
    context?: { plant?: string; sector?: string }
): Promise<{ risks: DetectedRisk[]; model: string; rawResponse: string }> {
    const safeDescription = sanitizeInput(description);
    const prompt = `${SYSTEM_PROMPT}

No hay imagen. El operador describe la situación:
"${safeDescription}"
${context?.plant ? `Planta: ${sanitizeInput(context.plant)}` : ''}
${context?.sector ? `Sector: ${sanitizeInput(context.sector)}` : ''}

Analizá la descripción y detectá los riesgos mencionados.`;

    let lastError: Error | null = null;
    for (const modelName of MODELS_FALLBACK) {
        try {
            const model = getModel(modelName);
            const result = await model.generateContent(prompt);
            
            const response = result.response;
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';

            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);

            const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => ({
                id: uuidv4(),
                category: validateCategory(r.category),
                description: r.description || 'Riesgo detectado',
                level: validateLevel(r.level),
                confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                recommendation: r.recommendation,
                status: 'pendiente' as const,
                aiModel: modelName,
            }));

            return { risks, model: modelName, rawResponse: text };
        } catch (err: any) {
            logger.warn('ai', 'Model failed for text analysis', { model: modelName, error: err.message });
            lastError = err;
            continue;
        }
    }

    throw new Error(`All AI models failed for text analysis. Last error: ${lastError?.message}`);
}

function validateCategory(c: string): RiskCategory {
    if (['epp', 'condiciones', 'comportamiento'].includes(c)) return c as RiskCategory;
    return 'condiciones';
}

function validateLevel(l: string): RiskLevel {
    if (['alto', 'medio', 'bajo'].includes(l)) return l as RiskLevel;
    return 'medio';
}
