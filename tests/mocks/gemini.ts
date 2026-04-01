import { vi } from 'vitest';

const mockRisksResponse = JSON.stringify({
    risks: [
        {
            category: 'epp',
            description: 'Operario sin casco de seguridad (IRAM 3620) en zona de producción',
            level: 'alto',
            confidence: 92,
            recommendation: 'Proveer casco certificado y verificar uso obligatorio',
        },
        {
            category: 'condiciones',
            description: 'Cables eléctricos expuestos en piso de tránsito',
            level: 'medio',
            confidence: 85,
            recommendation: 'Canalizar cableado con bandejas portacables',
        },
    ],
});

const mockValidationResponse = JSON.stringify({
    isIndustrial: true,
    reason: 'Imagen muestra un entorno de planta industrial',
});

// Mock de @google/generative-ai
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockImplementation(async (input: any) => {
                // Detectar si es validación o análisis por el contenido del prompt
                const text = Array.isArray(input)
                    ? input.find((i: any) => i.text)?.text || ''
                    : input;

                const isValidation = text.includes('isIndustrial');
                return {
                    response: {
                        text: () => isValidation ? mockValidationResponse : mockRisksResponse,
                    },
                };
            }),
        }),
    })),
}));
