import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Building2, Plus, AlertTriangle, CheckCircle, Clock,
    Loader2, ChevronRight, RefreshCw, Search, Trash2
} from 'lucide-react';

interface CompanyStats {
    companyId: string;
    name: string;
    totalInspections: number;
    totalRisks: number;
    highRisks: number;
    pendingTasks: number;
    resolvedPct: number;
    lastInspectionDate: string | null;
}

interface Props {
    onSelectCompany: (companyId: string, companyName: string) => void;
    onNewCompany: () => void;
}

export const CompaniesView: React.FC<Props> = ({ onSelectCompany, onNewCompany }) => {
    const { authFetch, user } = useAuth();
    const [companies, setCompanies] = useState<CompanyStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/companies/list');
            const data = await res.json();
            if (data.ok) setCompanies(data.companies || []);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchCompanies(); }, []);

    const handleDelete = async (e: React.MouseEvent, companyId: string, name: string) => {
        e.stopPropagation(); // evitar que dispare onSelectCompany
        if (!window.confirm(`¿Archivar "${name}"? Sus inspecciones se conservan.`)) return;
        setDeletingId(companyId);
        try {
            const res = await authFetch(`/api/companies/${companyId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.ok) {
                setCompanies(prev => prev.filter(c => c.companyId !== companyId));
            } else {
                alert(data.error || 'No se pudo eliminar la empresa');
            }
        } catch {
            alert('Error de red al eliminar');
        }
        setDeletingId(null);
    };

    const filtered = search
        ? companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        : companies;

    // KPIs globales
    const globalStats = {
        totalCompanies: companies.length,
        totalInspections: companies.reduce((s, c) => s + c.totalInspections, 0),
        totalHighRisks: companies.reduce((s, c) => s + c.highRisks, 0),
        totalPending: companies.reduce((s, c) => s + c.pendingTasks, 0),
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Seleccionar Empresa</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchCompanies} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {user?.role === 'admin' && (
                        <button onClick={onNewCompany}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
                            <Plus className="w-4 h-4" /> Nueva Empresa
                        </button>
                    )}
                </div>
            </div>


            {/* Company cards */}
            {loading && !companies.length ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                    <Building2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">{search ? 'No se encontraron empresas' : 'No hay empresas registradas'}</p>
                    {user?.role === 'admin' && (
                        <button onClick={onNewCompany} className="mt-3 text-blue-400 text-sm font-semibold hover:text-blue-300">
                            + Crear la primera empresa
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filtered.map(c => (
                        <div key={c.companyId}
                            onClick={() => onSelectCompany(c.companyId, c.name)}
                            className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 cursor-pointer hover:bg-slate-800/50 hover:border-slate-700 transition-colors group">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">{c.name}</div>
                                        <div className="text-[10px] text-slate-600">
                                            {c.lastInspectionDate
                                                ? `Última: ${new Date(c.lastInspectionDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`
                                                : 'Sin inspecciones'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {user?.role === 'admin' && (
                                        <button
                                            onClick={(e) => handleDelete(e, c.companyId, c.name)}
                                            disabled={deletingId === c.companyId}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                                            title="Archivar empresa"
                                        >
                                            {deletingId === c.companyId
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 border-t border-slate-800/50 pt-3 mt-3">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-300 font-mono">{c.totalInspections}</div>
                                    <div className="text-[9px] text-slate-600 uppercase">Insp.</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-amber-400 font-mono">{c.totalRisks}</div>
                                    <div className="text-[9px] text-slate-600 uppercase">Riesgos</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-red-400 font-mono">{c.highRisks}</div>
                                    <div className="text-[9px] text-slate-600 uppercase">Altos</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-emerald-400 font-mono">{c.resolvedPct}%</div>
                                    <div className="text-[9px] text-slate-600 uppercase">Resol.</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
