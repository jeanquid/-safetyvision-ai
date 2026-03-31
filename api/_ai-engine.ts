import { GoogleGenerativeAI } from '@google/generative-ai';
import { DetectedRisk, RiskLevel, RiskCategory } from './_types.js';
import { v4 as uuidv4 } from 'uuid';

const MODELS_FALLBACK = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];

const SYSTEM_PROMPT = `Eres un experto en seguridad industrial e higiene ocupacional.
Analizás imágenes de plantas industriales, obras y entornos laborales para detectar riesgos de seguridad.

Tu tarea: Analizar la imagen y detectar TODOS los riesgos de seguridad visibles.

Para cada riesgo detectado, devolvé un objeto JSON con:
- category: "epp" | "condiciones" | "comportamiento"
  - epp: Equipos de protección personal faltantes (casco, guantes, protección auditiva, chaleco, lentes, barbijo, arnés)
  - condiciones: Condiciones inseguras del entorno (cables sueltos, derrames, maquinaria sin protección, objetos en zonas de paso, iluminación deficiente, señalización faltante)
  - comportamiento: Comportamientos riesgosos del personal (zona restringida, mal uso de herramientas, posturas peligrosas)
- description: Descripción clara y específica del riesgo en español
- level: "alto" | "medio" | "bajo"
  - alto: Riesgo de lesión grave o muerte → acción inmediata
  - medio: Riesgo de lesión moderada → corrección programada
  - bajo: Riesgo menor → seguimiento
- confidence: Número entre 60 y 99 indicando tu confianza en la detección

IMPORTANTE:
- Sé específico. No digas "falta EPP", decí "Operario sin casco de seguridad en zona de maquinaria pesada"
- Si no hay riesgos visibles, devolvé un array vacío
- Enfocate en riesgos REALES y VISIBLES, no especules

Respondé ÚNICAMENTE con un JSON válido, sin markdown, sin texto adicional:
{ "risks": [ { "category": "...", "description": "...", "level": "...", "confidence": 85 } ] }`;

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
            console.log(`[AI] Trying model: ${modelName}`);
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
            console.log(`[AI] Response from ${modelName}: ${text.substring(0, 200)}...`);

            // Parse JSON response
            const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleaned);

            const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => ({
                id: uuidv4(),
                category: validateCategory(r.category),
                description: r.description || 'Riesgo detectado',
                level: validateLevel(r.level),
                confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                status: 'pendiente' as const,
                aiModel: modelName,
            }));

            return { risks, model: modelName, rawResponse: text };
        } catch (err: any) {
            console.warn(`[AI] Model ${modelName} failed: ${err.message}`);
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

    const prompt = `${SYSTEM_PROMPT}

No hay imagen. El operador describe la situación:
"${description}"
${context?.plant ? `Planta: ${context.plant}` : ''}
${context?.sector ? `Sector: ${context.sector}` : ''}

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
                status: 'pendiente' as const,
                aiModel: modelName,
            }));

            return { risks, model: modelName, rawResponse: text };
        } catch (err: any) {
            console.warn(`[AI] Model ${modelName} failed for text: ${err.message}`);
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
