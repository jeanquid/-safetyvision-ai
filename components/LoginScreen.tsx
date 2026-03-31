import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const result = await login(email, password);
        if (!result.ok) setError(result.error || 'Error de autenticación');
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-4">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        <span className="text-blue-400">Safety</span>Vision
                        <span className="text-xs text-slate-500 ml-2">AI</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Plataforma de Seguridad Industrial</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="usuario@empresa.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>

                <p className="text-center text-slate-600 text-xs mt-4">
                    SafetyVision AI v1.0 · Nodo8
                </p>
            </div>
        </div>
    );
};
