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
    recommendation?: string;
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
    companyId: string;       // NUEVO — obligatorio
    companyName?: string;    // NUEVO — para display sin join
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
