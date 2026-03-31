export type RiskLevel = 'alto' | 'medio' | 'bajo';
export type RiskCategory = 'epp' | 'condiciones' | 'comportamiento';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'resuelto';
export type InspectionStatus = 'analyzing' | 'pending_review' | 'active' | 'closed';

export interface DetectedRisk {
    id: string;
    category: RiskCategory;
    description: string;
    level: RiskLevel;
    confidence: number;
    status: TaskStatus;
    aiModel?: string;
}

export interface CorrectiveTask {
    action: string;
    responsible: string;
    deadline: string;
    status: TaskStatus;
    resolvedAt?: string;
    resolvedBy?: string;
    notes?: string;
}

export interface InspectionState {
    inspectionId: string;
    tenantId: string;
    userId: string;
    status: InspectionStatus;
    plant: string;
    sector: string;
    operator: string;
    photoUrl?: string;
    risks: DetectedRisk[];
    task: CorrectiveTask;
    aiAnalysis?: {
        model: string;
        analyzedAt: string;
        rawResponse?: string;
    };
    createdAt: string;
    updatedAt: string;
}
