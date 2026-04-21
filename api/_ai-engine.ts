import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetectedRisk, RiskLevel, RiskCategory } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';

const MODELS_FALLBACK = [
    'gemini-2.5-flash-preview-04-17',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
];

function sanitizeInput(text: string): string {
    if (!text) return '';
    // Remover instrucciones que intenten manipular el prompt
    return text
        .replace(/```/g, '')
        .replace(/\{[^}]*\}/g, '')     // remover JSON embebido
        .substring(0, 1000)             // limitar largo
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent([
            { text: VALIDATION_PROMPT },
            { inlineData: { mimeType, data: imageBase64 } }
        ]);
        const text = result.response.text();
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
            valid: parsed.isIndustrial === true,
            reason: parsed.reason || '',
        };
    } catch {
        // En caso de error, dejar pasar (fail open para no bloquear)
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
  - epp: Equipos de protección personal faltantes o inadecuados
  - condiciones: Condiciones inseguras del entorno físico
  - comportamiento: Actos inseguros o comportamientos riesgosos
- description: Descripción clara, específica y profesional del riesgo en español.
  Incluí qué norma o estándar se está incumpliendo cuando sea evidente.
  Ejemplo: "Operario sin casco de seguridad (IRAM 3620) en zona de maquinaria pesada con riesgo de caída de objetos"
- level: "alto" | "medio" | "bajo"
  - alto: Riesgo de lesión grave, incapacitante o muerte → acción inmediata (< 4hs)
  - medio: Riesgo de lesión moderada → corrección programada (< 24hs)
  - bajo: Riesgo menor, mejora de condiciones → seguimiento (< 48hs)
- confidence: Número entre 60 y 99 indicando tu confianza en la detección
- recommendation: Una acción correctiva concreta y específica

REGLAS:
- Sé específico: NO digas "falta EPP", SÍ decí qué EPP falta y dónde
- Si no hay riesgos visibles, devolvé un array vacío
- Enfocate en riesgos REALES y VISIBLES, no especules sobre lo que no se ve
- Máximo 8 riesgos por imagen — priorizá los más graves
- El campo recommendation debe ser una acción ejecutable, no una observación

Respondé ÚNICAMENTE con un JSON válido, sin markdown, sin texto adicional:
{ "risks": [ { "category": "...", "description": "...", "level": "...", "confidence": 85, "recommendation": "..." } ] }`;

export async function analyzeImageWithGemini(
    imageBase64: string,
    mimeType: string,
    context?: { plant?: string; sector?: string }
): Promise<{ risks: DetectedRisk[]; model: string; rawResponse: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: Error | null = null;

    for (const modelName of MODELS_FALLBACK) {
        try {
            logger.info('ai', 'Trying model', { model: modelName });
            const model = genAI.getGenerativeModel({ model: modelName });

            const contextInfo = context
                ? `\nContexto: Planta "${context.plant || 'N/A'}", Sector "${context.sector || 'N/A'}"`
                : '';

            const result = await model.generateContent([
                { text: SYSTEM_PROMPT + contextInfo },
                {
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: imageBase64
                    }
                }
            ]);

            const response = result.response;
            const text = response.text();
            logger.info('ai', 'Model response received', { model: modelName, preview: text.substring(0, 100) });

            // Parse JSON response
            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);

            const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => ({
                id: uuidv4(),
                category: validateCategory(r.category),
                description: r.description || 'Riesgo detectado',
                level: validateLevel(r.level),
                confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                recommendation: r.recommendation, // NUEVO
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const genAI = new GoogleGenerativeAI(apiKey);

    const safeDescription = sanitizeInput(description);

    const prompt = `${SYSTEM_PROMPT}

No hay imagen. El operador describe la situación:
"${safeDescription}"
${context?.plant ? `Planta: ${sanitizeInput(context.plant)}` : ''}
${context?.sector ? `Sector: ${sanitizeInput(context.sector)}` : ''}

Analizá la descripción y detectá los riesgos mencionados.`;

    for (const modelName of MODELS_FALLBACK) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);

            const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => ({
                id: uuidv4(),
                category: validateCategory(r.category),
                description: r.description || 'Riesgo detectado',
                level: validateLevel(r.level),
                confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                recommendation: r.recommendation, // NUEVO
                status: 'pendiente' as const,
                aiModel: modelName,
            }));

            return { risks, model: modelName, rawResponse: text };
        } catch (err: any) {
            logger.warn('ai', 'Model failed for text analysis, trying fallback', { model: modelName, error: err.message });
            continue;
        }
    }

    throw new Error('All AI models failed for text analysis');
}

function validateCategory(c: string): RiskCategory {
    if (['epp', 'condiciones', 'comportamiento'].includes(c)) return c as RiskCategory;
    return 'condiciones';
}

function validateLevel(l: string): RiskLevel {
    if (['alto', 'medio', 'bajo'].includes(l)) return l as RiskLevel;
    return 'medio';
}
