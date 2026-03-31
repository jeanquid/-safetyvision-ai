import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    displayName: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
    logout: () => void;
    authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const saved = sessionStorage.getItem('auth_token');
        if (saved) {
            setToken(saved);
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${saved}` }
            })
                .then(r => r.json())
                .then(data => {
                    if (data.ok && data.user) setUser(data.user);
                    else { sessionStorage.removeItem('auth_token'); setToken(null); }
                })
                .catch(() => { sessionStorage.removeItem('auth_token'); setToken(null); })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.ok && data.token) {
                sessionStorage.setItem('auth_token', data.token);
                setToken(data.token);
                setUser(data.user);
                return { ok: true };
            }
            return { ok: false, error: data.error || 'Login failed' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    };

    const logout = () => {
        sessionStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
    };

    const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
        const t = sessionStorage.getItem('auth_token');
        return fetch(url, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
                ...(opts.headers || {}),
            },
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
};
