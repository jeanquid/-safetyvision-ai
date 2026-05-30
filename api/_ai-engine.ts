import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import { DetectedRisk, RiskLevel, RiskCategory, Probability, Consequence, RiskAssessment, deriveLevelFromScore } from './_types.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './_logger.js';
import { sanitizeInput } from './_utils.js';
export { sanitizeInput };

const MODELS_FALLBACK = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
];

const ENABLE_LEGAL_GROUNDING = true;

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

const DEFAULT_SAFETY_CONTEXT = `Eres un experto en seguridad e higiene industrial certificado.
Analizar la imagen y detectar riesgos de seguridad.
Respondé ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "risks": [
    {
      "category": "...",
      "description": "...",
      "level": "...",
      "probability": 3,
      "probabilityJustification": "...",
      "consequence": 4,
      "consequenceJustification": "...",
      "confidence": 85,
      "recommendation": "...",
      "bbox": {
        "x": 0.12,
        "y": 0.34,
        "w": 0.25,
        "h": 0.40,
        "label": "Operario sin casco"
      }
    }
  ]
}
Nota: "probability" y "consequence" deben ser enteros de 1 a 5 (1: muy bajo/insignificante, 5: muy alto/catastrófico). "level" debe ser derivado (bajo, medio, alto) según los cortes: score (probabilidad * consecuencia) <= 5 bajo, 6-12 medio, >=13 alto. Justifica brevemente la asignación de probabilidad y consecuencia.
Si el análisis proviene de una imagen, incluye en "bbox" (bounding box) las coordenadas normalizadas de 0 a 1 (0 es arriba/izquierda, 1 es abajo/derecha) y un "label" corto descriptivo del riesgo. Si no es una imagen o no se puede ubicar claramente, "bbox" debe ser null.`;

const ENSI_SAFETY_CONTEXT = `Eres el asistente de inspecciones de ENSI S.E., empresa
especializada en servicios de ingeniería para la industria petrolera y
gasífera de Neuquén. Las inspecciones se realizan en yacimientos,
plantas y pozos de Vaca Muerta y otras zonas de la Patagonia.
Los riesgos más frecuentes en este contexto son:
- Trabajo en altura sin arnés (perforaciones, equipos)
- Ausencia de EPP específico O&G (casco, antiparras, guantes resistentes)
- Exposición a gases (H2S, CH4, SO2) — requiere detector personal
- Herramientas o equipos sin bloqueo LOTO
- Vehículos en movimiento sin señalización
- Condiciones eléctricas inseguras en instalaciones de campo
Clasificar siempre según Ley 19.587 / Decreto 351/79 y resoluciones SRT.
Respondé ÚNICAMENTE con un JSON válido con la siguiente estructura:
{
  "risks": [
    {
      "category": "...",
      "description": "...",
      "level": "...",
      "probability": 3,
      "probabilityJustification": "...",
      "consequence": 4,
      "consequenceJustification": "...",
      "confidence": 85,
      "recommendation": "...",
      "bbox": {
        "x": 0.12,
        "y": 0.34,
        "w": 0.25,
        "h": 0.40,
        "label": "Operario sin arnés"
      }
    }
  ]
}
Nota: "probability" y "consequence" deben ser enteros de 1 a 5 (1: muy bajo/insignificante, 5: muy alto/catastrófico). "level" debe ser derivado (bajo, medio, alto) según los cortes: score (probabilidad * consecuencia) <= 5 bajo, 6-12 medio, >=13 alto. Justifica brevemente la asignación de probabilidad y consecuencia.
Si el análisis proviene de una imagen, incluye en "bbox" (bounding box) las coordenadas normalizadas de 0 a 1 (0 es arriba/izquierda, 1 es abajo/derecha) y un "label" corto descriptivo del riesgo. Si no es una imagen o no se puede ubicar claramente, "bbox" debe ser null.`;

function getSystemPrompt(): string {
    return process.env.TENANT === 'ensi' ? ENSI_SAFETY_CONTEXT : DEFAULT_SAFETY_CONTEXT;
}

const SYSTEM_PROMPT = DEFAULT_SAFETY_CONTEXT;

export async function analyzeImageWithGemini(
    imageBase64: string,
    mimeType: string,
    context?: { plant?: string; sector?: string }
): Promise<{ risks: DetectedRisk[]; model: string; rawResponse: string; width?: number; height?: number }> {
    let width: number | undefined;
    let height: number | undefined;
    try {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(Buffer.from(imageBase64, 'base64')).metadata();
        width = meta.width;
        height = meta.height;
    } catch (e: any) {
        logger.warn('ai', 'Failed to get image size in analyzeImageWithGemini', { error: e.message });
    }

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
                    { text: getSystemPrompt() + contextInfo },
                    { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
                ]);

                const response = result.response;
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';
                const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);

                const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => {
                    const level = validateLevel(r.level);
                    let assessment: RiskAssessment | undefined = undefined;
                    
                    const prob = parseInt(r.probability, 10);
                    const cons = parseInt(r.consequence, 10);
                    
                    if (!isNaN(prob) && prob >= 1 && prob <= 5 && !isNaN(cons) && cons >= 1 && cons <= 5) {
                        const score = prob * cons;
                        const derivedLevel = deriveLevelFromScore(score);
                        assessment = {
                            probability: prob as Probability,
                            consequence: cons as Consequence,
                            score,
                            level: derivedLevel,
                            source: 'ai',
                            probabilityJustification: r.probabilityJustification,
                            consequenceJustification: r.consequenceJustification
                        };
                    }

                    let bbox = null;
                    if (r.bbox && typeof r.bbox === 'object') {
                        const x = Math.min(1, Math.max(0, parseFloat(r.bbox.x)));
                        const y = Math.min(1, Math.max(0, parseFloat(r.bbox.y)));
                        const w = Math.min(1, Math.max(0, parseFloat(r.bbox.w)));
                        const h = Math.min(1, Math.max(0, parseFloat(r.bbox.h)));
                        const label = r.bbox.label ? String(r.bbox.label).trim() : '';
                        if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
                            bbox = { x, y, w, h, label };
                        }
                    }
                    
                    return {
                        id: uuidv4(),
                        category: validateCategory(r.category),
                        description: r.description || 'Riesgo detectado',
                        level: assessment ? assessment.level : level,
                        confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                        recommendation: r.recommendation,
                        status: 'pendiente' as const,
                        aiModel: `${provider}:${modelName}`,
                        assessment,
                        bbox,
                        history: [],
                    };
                });

                // Fundamentación normativa con RAG (Feature B)
                if (ENABLE_LEGAL_GROUNDING && process.env.TENANT === 'ensi') {
                    const { retrieveLegalBasis } = await import('./_legal/retriever.js');
                    for (const risk of risks) {
                        try {
                            risk.legalBasis = await retrieveLegalBasis(risk.description, 'ensi');
                        } catch (err: any) {
                            logger.error('ai', 'Failed to retrieve legal basis for risk', { riskId: risk.id, error: err.message });
                            risk.legalBasis = null;
                        }
                    }
                }

                return { risks, model: `${provider}:${modelName}`, rawResponse: text, width, height };
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
    const prompt = `${getSystemPrompt()}\nSituación: "${safeDescription}"`;
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

                const risks: DetectedRisk[] = (parsed.risks || []).map((r: any) => {
                    const level = validateLevel(r.level);
                    let assessment: RiskAssessment | undefined = undefined;
                    
                    const prob = parseInt(r.probability, 10);
                    const cons = parseInt(r.consequence, 10);
                    
                    if (!isNaN(prob) && prob >= 1 && prob <= 5 && !isNaN(cons) && cons >= 1 && cons <= 5) {
                        const score = prob * cons;
                        const derivedLevel = deriveLevelFromScore(score);
                        assessment = {
                            probability: prob as Probability,
                            consequence: cons as Consequence,
                            score,
                            level: derivedLevel,
                            source: 'ai',
                            probabilityJustification: r.probabilityJustification,
                            consequenceJustification: r.consequenceJustification
                        };
                    }
                    
                    return {
                        id: uuidv4(),
                        category: validateCategory(r.category),
                        description: r.description || 'Riesgo detectado',
                        level: assessment ? assessment.level : level,
                        confidence: Math.min(99, Math.max(60, r.confidence || 75)),
                        recommendation: r.recommendation,
                        status: 'pendiente' as const,
                        aiModel: `${provider}:${modelName}`,
                        assessment,
                        bbox: null,
                        history: [],
                    };
                });

                // Fundamentación normativa con RAG (Feature B)
                if (ENABLE_LEGAL_GROUNDING && process.env.TENANT === 'ensi') {
                    const { retrieveLegalBasis } = await import('./_legal/retriever.js');
                    for (const risk of risks) {
                        try {
                            risk.legalBasis = await retrieveLegalBasis(risk.description, 'ensi');
                        } catch (err: any) {
                            logger.error('ai', 'Failed to retrieve legal basis for risk', { riskId: risk.id, error: err.message });
                            risk.legalBasis = null;
                        }
                    }
                }

                return {
                    risks,
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

export async function getEmbedding(text: string): Promise<number[]> {
    const providers: ('vertex' | 'studio')[] = ['vertex', 'studio'];
    let lastError: Error | null = null;
    
    for (const provider of providers) {
        try {
            const model = getClient(provider, 'text-embedding-004');
            if (!model) continue;
            
            logger.info('ai', `Generating embedding with ${provider}:text-embedding-004`);
            const result = await (model as any).embedContent(text);
            if (result && result.embedding && result.embedding.values) {
                return result.embedding.values;
            }
        } catch (err: any) {
            logger.warn('ai', `Embedding failed with ${provider}:text-embedding-004`, { error: err.message });
            lastError = err;
        }
    }
    throw new Error(`All embedding models failed. Last error: ${lastError?.message}`);
}

export async function transcribeAndStructureAudio(
    audioBase64: string,
    mimeType: string,
    tenantId: string
): Promise<{
    transcript: string;
    structured: {
        description: string;
        suggestedCategory: string;
        plant?: string;
        sector?: string;
    };
}> {
    const isEnsi = tenantId === 'ensi';
    const categories = isEnsi
        ? [
            'Perforación y completación',
            'Transporte y logística',
            'Instalaciones eléctricas',
            'Manejo de sustancias peligrosas',
            'Trabajo en altura',
            'Espacios confinados',
            'Mediciones ambientales'
          ]
        : [
            'Equipos de Protección Personal',
            'Condiciones de seguridad',
            'Comportamiento del personal',
            'Riesgo eléctrico',
            'Trabajo en altura',
            'Otros'
          ];

    const prompt = `Analizá este fragmento de audio de un inspector de seguridad en campo.
Tu tarea es transcribir el audio y estructurar el hallazgo.
Debes responder ÚNICAMENTE con un JSON válido con la siguiente estructura (sin markdown, sin bloques de código, solo el texto JSON):
{
  "transcript": "transcripción textual exacta en español",
  "structured": {
    "description": "descripción limpia, clara y formal del hallazgo de seguridad en español",
    "suggestedCategory": "la categoría sugerida",
    "plant": "planta/yacimiento/locación si se menciona (string), o null",
    "sector": "sector/área/pozo si se menciona (string), o null"
  }
}

Categorías permitidas para sugerir (mapea a la que mejor se adapte):
${categories.map(c => `- ${c}`).join('\n')}

Por favor, sé conciso y preciso. Si no se mencionan planta o sector en el audio, pon null.`;

    let lastError: Error | null = null;
    const providers: ('vertex' | 'studio')[] = ['vertex', 'studio'];
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];

    for (const provider of providers) {
        for (const modelName of models) {
            try {
                const model = getClient(provider, modelName);
                if (!model) continue;

                logger.info('ai', `Transcribing audio with ${provider}:${modelName}`);
                const result = await (model as any).generateContent([
                    { text: prompt },
                    { inlineData: { mimeType, data: audioBase64 } }
                ]);

                const response = result.response;
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text || (response as any).text?.() || '';
                const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const parsed = JSON.parse(cleaned);

                if (!parsed.transcript || !parsed.structured) {
                    throw new Error('Invalid transcription response structure');
                }

                return {
                    transcript: parsed.transcript,
                    structured: {
                        description: parsed.structured.description || '',
                        suggestedCategory: parsed.structured.suggestedCategory || (isEnsi ? 'Perforación y completación' : 'Otros'),
                        plant: parsed.structured.plant || undefined,
                        sector: parsed.structured.sector || undefined
                    }
                };
            } catch (err: any) {
                logger.warn('ai', `Transcription failed with ${provider}:${modelName}`, { error: err.message });
                lastError = err;
            }
        }
    }
    throw new Error(`All transcription models failed. Last error: ${lastError?.message}`);
}
