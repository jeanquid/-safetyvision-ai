import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, Loader2, RefreshCw, Building2, HardHat, Factory, Construction } from 'lucide-react';
import { InspectionsList } from './InspectionsList';

const RISK_COLORS: Record<string, string> = { alto: '#EF4444', medio: '#F59E0B', bajo: '#22C55E' };
const CAT_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
    epp: { label: 'EPP', Icon: HardHat, color: '#3B82F6' },
    condiciones: { label: 'Condiciones', Icon: Factory, color: '#8B5CF6' },
    comportamiento: { label: 'Comportamiento', Icon: Construction, color: '#EC4899' },
};

interface DashboardProps {
    companyId?: string;
    companyName?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ companyId, companyName }) => {
    const { authFetch } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const url = companyId ? `/api/dashboard?companyId=${companyId}` : '/api/dashboard';
            const res = await authFetch(url);
            const data = await res.json();
            if (data.ok) setStats(data);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchStats(); }, [companyId]);

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    const s = stats || { totalInspections: 0, totalRisks: 0, highRisks: 0, pendingTasks: 0, resolvedPct: 0, byCategory: {}, byLevel: {}, bySector: [] };

    return (
        <div className="space-y-6">
            <div className="flex justify-end -mt-2 mb-2">
                <button onClick={fetchStats} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800" title="Actualizar métricas">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: <AlertTriangle className="w-5 h-5" />, value: s.totalRisks, label: 'Riesgos Detectados', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { icon: <AlertTriangle className="w-5 h-5" />, value: s.highRisks, label: 'Riesgos Altos', color: 'text-red-400', bg: 'bg-red-500/10' },
                    { icon: <Clock className="w-5 h-5" />, value: s.pendingTasks, label: 'Tareas Pendientes', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: <CheckCircle className="w-5 h-5" />, value: `${s.resolvedPct}%`, label: 'Tasa Resolución', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                        <div className={`inline-flex p-2 rounded-xl ${kpi.bg} ${kpi.color} mb-3`}>{kpi.icon}</div>
                        <div className={`text-3xl font-bold ${kpi.color} font-mono`}>{kpi.value}</div>
                        <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{kpi.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* By Category */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Por Categoría</h3>
                    {Object.entries(CAT_META).map(([key, meta]) => {
                        const val = s.byCategory[key] || 0;
                        const max = Math.max(...Object.values(s.byCategory || {}).map(Number), 1);
                        return (
                            <div key={key} className="mb-3">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-400 inline-flex items-center gap-1.5">
                                        <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                        {meta.label}
                                    </span>
                                    <span className="font-bold font-mono" style={{ color: meta.color }}>{val}</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(val / max) * 100}%`, background: meta.color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* By Severity */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Por Gravedad</h3>
                    <div className="flex justify-center gap-6 mt-2">
                        {(['alto', 'medio', 'bajo'] as const).map(level => (
                            <div key={level} className="text-center">
                                <div
                                    className="w-16 h-16 rounded-full flex items-center justify-center border-2 mb-2 mx-auto"
                                    style={{ borderColor: RISK_COLORS[level], background: `${RISK_COLORS[level]}15` }}
                                >
                                    <span className="text-xl font-bold font-mono" style={{ color: RISK_COLORS[level] }}>
                                        {s.byLevel[level] || 0}
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: RISK_COLORS[level] }}>{level}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sector Ranking */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ranking Sectores</h3>
                    {(s.bySector || []).slice(0, 5).map(([sector, count]: [string, number], i: number) => (
                        <div key={sector} className="flex items-center gap-3 py-2 border-b border-slate-800/50 last:border-0">
                            <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${i === 0 ? 'bg-red-500/15 text-red-400' : 'bg-slate-800 text-slate-500'}`}>{i + 1}</span>
                            <span className="flex-1 text-xs text-slate-400 truncate">{sector}</span>
                            <span className={`text-sm font-bold font-mono ${i === 0 ? 'text-red-400' : 'text-slate-500'}`}>{count}</span>
                        </div>
                    ))}
                    {(!s.bySector || s.bySector.length === 0) && (
                        <p className="text-xs text-slate-600 text-center py-4">Sin datos aún</p>
                    )}
                </div>
            </div>
            
            {/* Inspecciones directamente en el dashboard si hay una empresa seleccionada */}
            {companyId && (
                <div className="mt-10 border-t border-slate-800/50 pt-8">
                    <InspectionsList companyId={companyId} />
                </div>
            )}
        </div>
    );
};
