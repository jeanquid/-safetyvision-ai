export interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: 'admin' | 'inspector' | 'supervisor';
    tenantId: string;
    displayName: string;
    createdAt: string;
}

export interface AuthPayload {
    userId: string;
    email: string;
    role: 'admin' | 'inspector' | 'supervisor';
    tenantId: string;
    displayName: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    ok: boolean;
    token?: string;
    user?: Omit<User, 'passwordHash'>;
    error?: string;
}
