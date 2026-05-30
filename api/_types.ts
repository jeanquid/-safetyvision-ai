export type RiskLevel = 'alto' | 'medio' | 'bajo';
export type RiskCategory = 'epp' | 'condiciones' | 'comportamiento';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'resuelto';
export type InspectionStatus = 'analyzing' | 'pending_review' | 'active' | 'closed';

export type Probability = 1 | 2 | 3 | 4 | 5;
export type Consequence = 1 | 2 | 3 | 4 | 5;

export interface RiskAssessment {
    probability: Probability;
    consequence: Consequence;
    score: number;
    level: RiskLevel;
    source: 'ai' | 'inspector';
    confirmedBy?: string;
    confirmedAt?: string;
    probabilityJustification?: string;
    consequenceJustification?: string;
}

/**
 * Derives the RiskLevel ('bajo' | 'medio' | 'alto') from a 1-25 matrix score.
 * Cuts:
 * - 1 to 5: 'bajo' (Green)
 * - 6 to 12: 'medio' (Yellow)
 * - 13 to 25: 'alto' (Red)
 */
export function deriveLevelFromScore(score: number): RiskLevel {
    if (score <= 5) return 'bajo';
    if (score <= 12) return 'medio';
    return 'alto';
}

export interface AuditEntry {
    id: string;
    riskId: string;
    action: 'status_change' | 'note_added' | 'risk_edited' | 'inspection_created' | 'photo_signed' | string;
    fromStatus?: TaskStatus;
    toStatus?: TaskStatus;
    note?: string;
    inspectorId: string;
    inspectorEmail: string;
    inspectorName: string;
    timestamp: string;
    /** SHA-256 hash */
    seal: string;
    photoHash?: string;
    sealVersion?: 1 | 2;
}


export interface LegalBasis {
    articleId: string;
    norma: string;
    citation: string;
    relevance: number;
}

export interface BBox {
    x: number; // 0-1 normalized
    y: number; // 0-1 normalized
    w: number; // 0-1 normalized
    h: number; // 0-1 normalized
    label: string;
}

export interface DetectedRisk {
    id: string;
    category: RiskCategory;
    description: string;
    level: RiskLevel;
    confidence: number;
    recommendation?: string;
    status: TaskStatus;
    updatedBy?: string;
    updatedAt?: string;
    history: AuditEntry[];
    aiModel?: string;
    legalBasis?: LegalBasis | null;
    assessment?: RiskAssessment;
    bbox?: BBox | null;
}

export interface CorrectiveTask {
    action: string;
    responsible: string;
    deadline: string;
    /** @deprecated — se mantiene por compatibilidad, pero el status real se deriva de los riesgos */
    status: TaskStatus;
    resolvedAt?: string;
    resolvedBy?: string;
    notes?: string;
}

export interface Company {
    companyId: string;
    tenantId: string;
    name: string;
    rut?: string;
    address?: string;
    contactName?: string;
    contactPhone?: string;
    plants: { name: string; sectors: string[] }[];
    notes?: string;
    status: 'active' | 'archived';
    createdAt: string;
    updatedAt: string;
}

export interface CompanyStats {
    companyId: string;
    name: string;
    totalInspections: number;
    totalRisks: number;
    highRisks: number;
    pendingTasks: number;
    resolvedPct: number;
    lastInspectionDate: string | null;
}

export interface InspectionState {
    inspectionId: string;
    tenantId: string;
    userId: string;
    companyId: string;
    companyName?: string;
    status: InspectionStatus;
    plant: string;
    sector: string;
    operator: string;
    photoUrl?: string;
    risks: DetectedRisk[];
    task: CorrectiveTask;
    auditTrail: AuditEntry[];
    aiAnalysis?: {
        model: string;
        analyzedAt: string;
        rawResponse?: string;
        originalRisks?: any[];
    };
    createdAt: string;
    updatedAt: string;
    complianceState?: 'completo' | 'con_observaciones';
    complianceNotes?: string;
}

/**
 * Calcula el status global de la inspección a partir de los riesgos individuales.
 * - Si todos resueltos → 'closed'
 * - Si al menos uno en_progreso → 'active'
 * - Si todos pendientes → 'pending_review'
 */
export function deriveInspectionStatus(risks: DetectedRisk[]): InspectionStatus {
    if (risks.length === 0) return 'pending_review';
    const allResolved = risks.every(r => r.status === 'resuelto');
    if (allResolved) return 'closed';
    const anyInProgress = risks.some(r => r.status === 'en_progreso');
    if (anyInProgress) return 'active';
    const anyResolved = risks.some(r => r.status === 'resuelto');
    if (anyResolved) return 'active';
    return 'pending_review';
}

/**
 * Calcula el task.status derivado de los riesgos.
 */
export function deriveTaskStatus(risks: DetectedRisk[]): TaskStatus {
    if (risks.length === 0) return 'pendiente';
    const allResolved = risks.every(r => r.status === 'resuelto');
    if (allResolved) return 'resuelto';
    const anyInProgress = risks.some(r => r.status === 'en_progreso' || r.status === 'resuelto');
    if (anyInProgress) return 'en_progreso';
    return 'pendiente';
}
