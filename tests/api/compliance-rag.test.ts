import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import './../../tests/mocks/db';
import './../../tests/mocks/gemini';
import { mockDb } from '../mocks/db';
import { retrieveLegalBasis } from '../../api/_legal/retriever.js';
import { analyzeTextDescription } from '../../api/_ai-engine.js';

beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
});

beforeEach(() => {
    mockDb._clear();
});

describe('Compliance RAG System', () => {
    describe('retrieveLegalBasis (RAG Retriever)', () => {
        it('debe recuperar el fundamento legal correcto para una consulta de EPP (casco)', async () => {
            const result = await retrieveLegalBasis('El trabajador no posee casco ni EPP', 'ensi');
            
            expect(result).not.toBeNull();
            expect(result!.articleId).toBe('dec-351-79-anexo-VI-epp');
            expect(result!.norma).toBe('Decreto 351/79');
            expect(result!.citation).toContain('Los equipos de protección personal deberán ser proporcionados');
            expect(result!.relevance).toBeGreaterThanOrEqual(0.9);
        });

        it('debe recuperar el fundamento legal correcto para una consulta de puesta a tierra', async () => {
            const result = await retrieveLegalBasis('Falta medición de puesta a tierra anual', 'ensi');
            
            expect(result).not.toBeNull();
            expect(result!.articleId).toBe('res-srt-900-15-art-1');
            expect(result!.norma).toBe('Res. SRT 900/15');
            expect(result!.citation).toContain('Establece con carácter obligatorio la medición de puesta a tierra');
            expect(result!.relevance).toBeGreaterThanOrEqual(0.9);
        });

        it('debe devolver null si el score de similitud es inferior al umbral 0.55', async () => {
            // "unrelated" retorna un vector ortogonal que da similitud 0.0
            const result = await retrieveLegalBasis('unrelated safety event description', 'ensi');
            expect(result).toBeNull();
        });

        it('debe devolver null si no hay chunks normativos para el tenant', async () => {
            const result = await retrieveLegalBasis('casco', 'non-existent-tenant');
            expect(result).toBeNull();
        });
    });

    describe('End-to-End Pipeline Integration', () => {
        it('debe adjuntar legalBasis a los riesgos si el tenant es ensi', async () => {
            const originalTenant = process.env.TENANT;
            try {
                process.env.TENANT = 'ensi';
                const { risks } = await analyzeTextDescription('Falta casco de seguridad en zona de produccion');
                
                expect(risks.length).toBeGreaterThan(0);
                const risk = risks[0];
                expect(risk.legalBasis).toBeDefined();
                expect(risk.legalBasis).not.toBeNull();
                expect(risk.legalBasis!.articleId).toBe('dec-351-79-anexo-VI-epp');
            } finally {
                process.env.TENANT = originalTenant;
            }
        });

        it('debe omitir / no adjuntar legalBasis a los riesgos si el tenant no es ensi', async () => {
            const originalTenant = process.env.TENANT;
            try {
                process.env.TENANT = 'sv-demo';
                const { risks } = await analyzeTextDescription('Falta casco de seguridad');
                
                expect(risks.length).toBeGreaterThan(0);
                const risk = risks[0];
                expect(risk.legalBasis).toBeUndefined();
            } finally {
                process.env.TENANT = originalTenant;
            }
        });
    });
});
