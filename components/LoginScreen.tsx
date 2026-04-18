import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

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

                {/* Logo HSE Ingeniería — primer plano */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-5">
                        {/* Isotipo HSE: círculo verde con letras */}
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: '#16a34a' }}>
                                <span className="text-white font-black text-lg tracking-tight leading-none">hse</span>
                            </div>
                            <div className="text-left">
                                <div className="text-white font-black text-xl tracking-wide leading-tight">HSE</div>
                                <div className="text-white font-bold text-xl tracking-wide leading-tight">INGENIERIA</div>
                            </div>
                        </div>
                    </div>

                    {/* Separador */}
                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-slate-600 text-[10px] uppercase tracking-widest">plataforma de seguridad</span>
                        <div className="flex-1 h-px bg-slate-800" />
                    </div>

                    {/* SafetyVision — segundo plano */}
                    <p className="text-slate-500 text-xs">
                        Powered by <span className="text-slate-400 font-semibold">SafetyVision AI</span>
                    </p>
                </div>

                {/* Formulario */}
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
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-600 transition-colors"
                            placeholder="usuario@hse-ingenieria.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-green-600 transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ backgroundColor: loading ? '#15803d' : '#16a34a' }}
                        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#15803d'; }}
                        onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#16a34a'; }}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>

                {/* Footer: SafetyVision + Nodo8 — tercer plano */}
                <p className="text-center text-slate-700 text-[10px] mt-5 tracking-wide">
                    SafetyVision AI v1.0 · Desarrollado por Nodo8
                </p>

            </div>
        </div>
    );
};
