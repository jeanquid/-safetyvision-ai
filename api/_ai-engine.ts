import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import { DetectedRisk, RiskLevel, RiskCategory } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';

const MODELS_FALLBACK = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
];

/**
 * Retorna un modelo configurado. Intenta Vertex AI primero si hay configuración,
 * de lo contrario cae en Google AI Studio.
 */
function getClient(type: 'vertex' | 'studio', modelName: string) {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || 'us-central1';
    const keyJson = process.env.GCP_KEY_JSON;
    const apiKey = process.env.GEMINI_API_KEY;

    if (type === 'vertex' && projectId) {
        const options: any = { project: projectId, location };
        if (keyJson) {
            try {
                options.googleAuthOptions = {
                    credentials: JSON.parse(keyJson)
                };
            } catch (e) {
                logger.error('ai', 'Failed to parse GCP_KEY_JSON', { error: (e as any).message });
            }
        }
        const vertexAI = new VertexAI(options);
        return vertexAI.getGenerativeModel({ model: modelName });
    } else if (type === 'studio' && apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: modelName });
    }
    return null;
}

function sanitizeInput(text: string): string {
    if (!text) return '';
    return text.replace(/```/g, '').replace(/\{[^}]*\}/g, '').substring(0, 1000).trim();
}

const VALIDATION_PROMPT = `Observá esta imagen y respondé ÚNICAMENTE con un JSON:
{ "isIndustrial": true/false, "reason": "breve explicación" }
Criterio: ¿La imagen muestra un entorno laboral, industrial, obra, planta, taller, almacén, o zona de trabajo?
Respondé SOLO el JSON, sin markdown.`;

export async function validateImage(
    imageBase64: string,
    mimeType: string
): Promise<{ valid: boolean; reason: string }> {
    const providers: ('vertex' | 'studio')[] = ['vertex', 'studio'];
    
    for (const provider of providers) {
        try {
            const model = getClient(provider, 'gemini-2.0-flash');
            if (!model) continue;

            const result = await model.generateContent([
                { text: VALIDATION_PROMPT },
                { inlineData: { mimeType, data: imageBase64 } }
            ]);
            
            const response = result.response;
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';
            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return { valid: parsed.isIndustrial === true, reason: parsed.reason || '' };
        } catch (error: any) {
            logger.warn('ai', `Validation failed with ${provider}, trying next`, { error: error.message });
        }
    }
    return { valid: true, reason: 'Validation skipped' };
}

const SYSTEM_PROMPT = `Eres un experto en seguridad e higiene industrial certificado.
Analizar la imagen y detectar riesgos de seguridad.
Respondé ÚNICAMENTE con un JSON válido:
{ "risks": [ { "category": "...", "description": "...", "level": "...", "confidence": 85, "recommendation": "..." } ] }`;

export async function analyzeImageWithGemini(
    imageBase64: string,
    mimeType: string,
    context?: { plant?: string; sector?: string }
): Promise<{ risks: DetectedRisk[]; model: string; rawResponse: string }> {
    let lastError: Error | null = null;
    const providers: ('vertex' | 'studio')[] = ['vertex', 'studio'];

    for (const provider of providers) {
        for (const modelName of MODELS_FALLBACK) {
            try {
                const model = getClient(provider, modelName);
                if (!model) continue;

                logger.info('ai', `Trying ${provider}:${modelName}`);
                const contextInfo = context ? `\nContexto: Planta "${context.plant}", Sector "${context.sector}"` : '';
                const result = await (model as any).generateContent([
                    { text: SYSTEM_PROMPT + contextInfo },
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
                ]);

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
                    aiModel: `${provider}:${modelName}`,
                }));

                return { risks, model: `${provider}:${modelName}`, rawResponse: text };
            } catch (err: any) {
                logger.warn('ai', `${provider}:${modelName} failed`, { error: err.message });
                lastError = err;
            }
        }
    }
    throw new Error(`All AI providers/models failed. Last error: ${lastError?.message}`);
}

export async function analyzeTextDescription(
    description: string,
    context?: { plant?: string; sector?: string }
): Promise<{ risks: DetectedRisk[]; model: string; rawResponse: string }> {
    const safeDescription = sanitizeInput(description);
    const prompt = `${SYSTEM_PROMPT}\nSituación: "${safeDescription}"`;
    let lastError: Error | null = null;
    const providers: ('vertex' | 'studio')[] = ['vertex', 'studio'];

    for (const provider of providers) {
        for (const modelName of MODELS_FALLBACK) {
            try {
                const model = getClient(provider, modelName);
                if (!model) continue;

                const result = await model.generateContent(prompt);
                const response = result.response;
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';
                const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);

                return {
                    risks: (parsed.risks || []).map((r: any) => ({
                        id: uuidv4(),
                        category: validateCategory(r.category),
                        description: r.description || 'Riesgo detectado',
                        level: validateLevel(r.level),
                        confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                        recommendation: r.recommendation,
                        status: 'pendiente' as const,
                        aiModel: `${provider}:${modelName}`,
                    })),
                    model: `${provider}:${modelName}`,
                    rawResponse: text
                };
            } catch (err: any) {
                lastError = err;
            }
        }
    }
    throw new Error(`Text analysis failed on all providers. Last error: ${lastError?.message}`);
}

function validateCategory(c: string): RiskCategory {
    if (['epp', 'condiciones', 'comportamiento'].includes(c)) return c as RiskCategory;
    return 'condiciones';
}
function validateLevel(l: string): RiskLevel {
    if (['alto', 'medio', 'bajo'].includes(l)) return l as RiskLevel;
    return 'medio';
}
