import { vi } from 'vitest';

const mockRisksResponse = JSON.stringify({
    risks: [
        {
            category: 'epp',
            description: 'Operario sin casco de seguridad (IRAM 3620) en zona de producción',
            level: 'alto',
            probability: 4,
            probabilityJustification: 'El operario trabaja a diario sin casco',
            consequence: 4,
            consequenceJustification: 'Golpes graves en la cabeza',
            confidence: 92,
            recommendation: 'Proveer casco certificado y verificar uso obligatorio',
            bbox: {
                x: 0.1,
                y: 0.2,
                w: 0.3,
                h: 0.4,
                label: 'Operario sin casco'
            }
        },
        {
            category: 'condiciones',
            description: 'Cables eléctricos expuestos en piso de tránsito',
            level: 'medio',
            probability: 3,
            probabilityJustification: 'Zona de alto tránsito',
            consequence: 3,
            consequenceJustification: 'Caídas del mismo nivel',
            confidence: 85,
            recommendation: 'Canalizar cableado con bandejas portacables',
            bbox: {
                x: 0.5,
                y: 0.6,
                w: 0.2,
                h: 0.2,
                label: 'Cables'
            }
        },
    ],
});

const mockValidationResponse = JSON.stringify({
    isIndustrial: true,
    reason: 'Imagen muestra un entorno de planta industrial',
});

// Implementacion compartida de los mocks de modelos
const createMockModel = () => ({
    generateContent: vi.fn().mockImplementation(async (input: any) => {
        const text = Array.isArray(input)
            ? input.find((i: any) => i.text)?.text || ''
            : typeof input === 'string' ? input : '';

        // Grounding RAG prompt check
        if (text.includes('Dada la descripción de un riesgo de seguridad') || text.includes('artículos normativos candidatos')) {
            const queryMatch = text.match(/Riesgo detectado:\s*"([^"]*)"/);
            const queryVal = queryMatch ? queryMatch[1].toLowerCase() : '';

            if (queryVal.includes('unrelated') || queryVal.includes('bajo umbral')) {
                return {
                    response: {
                        text: () => 'null',
                    },
                };
            }
            if (queryVal.includes('puesta a tierra') || queryVal.includes('medición')) {
                return {
                    response: {
                        text: () => JSON.stringify({
                            articleId: 'res-srt-900-15-art-1',
                            norma: 'Res. SRT 900/15',
                            citation: 'Establece con carácter obligatorio la medición de puesta a tierra anual.',
                            relevance: 0.95
                        }),
                    },
                };
            }
            return {
                response: {
                    text: () => JSON.stringify({
                        articleId: 'dec-351-79-anexo-VI-epp',
                        norma: 'Decreto 351/79',
                        citation: 'Los equipos de protección personal deberán ser proporcionados por el empleador.',
                        relevance: 0.92
                    }),
                },
            };
        }

        const isValidation = text.includes('isIndustrial');
        return {
            response: {
                text: () => isValidation ? mockValidationResponse : mockRisksResponse,
            },
        };
    }),
    embedContent: vi.fn().mockImplementation(async (text: string) => {
        const vec = new Array(768).fill(0);
        if (text.includes('casco') || text.includes('EPP')) {
            vec[1] = 1.0;
        } else if (text.includes('puesta a tierra') || text.includes('medición')) {
            vec[2] = 1.0;
        } else if (text.includes('empleador') || text.includes('obligaciones') || text.includes('employer')) {
            vec[0] = 1.0;
        } else {
            // Orthogonal vector that doesn't match any of the first three
            vec[10] = 1.0;
        }
        return {
            embedding: {
                values: vec
            }
        };
    })
});

const mockModel = createMockModel();

// Mock de @google/generative-ai
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
    })),
}));

// Mock de @google-cloud/vertexai
vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue(mockModel),
    })),
}));
