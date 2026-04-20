import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertTriangle, CheckCircle, Clock, ChevronRight, RefreshCw, ArrowLeft, FileDown, Camera, Building2, ClipboardList, Trash2, HardHat, Factory, Construction, PlayCircle, Lightbulb } from 'lucide-react';

const LEVEL_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
    alto: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'ALTO' },
    medio: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'MEDIO' },
    bajo: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'BAJO' },
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
    pendiente: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Pendiente', Icon: Clock },
    en_progreso: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'En progreso', Icon: PlayCircle },
    resuelto: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Resuelto', Icon: CheckCircle },
};

const CategoryIcon: React.FC<{ category: string; className?: string }> = ({ category, className = 'w-5 h-5' }) => {
    if (category === 'epp') return <HardHat className={className} />;
    if (category === 'condiciones') return <Factory className={className} />;
    return <Construction className={className} />;
};

interface Props {
    companyId?: string;
    preSelectInspectionId?: string | null;
    onBack?: () => void;
}

export const InspectionsList: React.FC<Props> = ({ companyId, preSelectInspectionId, onBack }) => {
    const { authFetch, user } = useAuth();
    const [inspections, setInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState<any>(null);
    const [updating, setUpdating] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, inspectionId: string) => {
        e.stopPropagation();
        if (!window.confirm('¿Estás seguro que deseas eliminar esta inspección permanentemente?')) return;
        setDeletingId(inspectionId);
        try {
            const res = await authFetch(`/api/inspections/${inspectionId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchList();
            }
        } catch (error) {
            console.error('Error deleting inspection', error);
        }
        setDeletingId(null);
    };

    const fetchList = async () => {
        setLoading(true);
        try {
            const url = companyId ? `/api/inspections/list?companyId=${companyId}` : '/api/inspections/list';
            const res = await authFetch(url);
            const data = await res.json();
            if (data.ok) {
                const list = data.inspections || [];
                setInspections(list);
                if (preSelectInspectionId) {
                    const found = list.find((i: any) => i.inspectionId === preSelectInspectionId);
                    if (found) loadInspectionDetail(found);
                }
            }
        } catch {}
        setLoading(false);
    };

    const handleExportCSV = () => {
        if (!filtered || filtered.length === 0) return;

        const headers = ["ID Corto", "Fecha", "Empresa", "Planta", "Sector", "Inspector", "Estado", "Total Riesgos", "Riesgos Altos", "Recomendacion IA"];
        
        const rows = filtered.map((ins: any) => {
            const highRisks = (ins.risks || []).filter((r: any) => r.level === 'alto').length;
            
            return [
                ins.inspectionId.substring(0, 8),
                new Date(ins.createdAt).toLocaleDateString('es-AR'),
                `"${ins.companyName || ''}"`,
                `"${ins.plant || ''}"`,
                `"${ins.sector || 'Sin especificar'}"`,
                `"${ins.operator || ''}"`,
                ins.task?.status || 'pendiente',
                (ins.risks || []).length,
                highRisks,
                `"${(ins.task?.action || '').replace(/"/g, '""')}"`
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(',') + "\n" + rows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `historial_inspecciones_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const loadInspectionDetail = async (ins: any) => {
        setSelected(ins);
        setPhotoLoading(true);
        try {
            const res = await authFetch(`/api/inspections/${ins.inspectionId}`);
            const data = await res.json();
            if (data.ok && data.inspection) {
                setSelected(data.inspection);
                if (data.inspection.resolvedPhotoUrl) {
                    try {
                        const pr = await authFetch(data.inspection.resolvedPhotoUrl);
                        if (pr.ok) {
                            const blob = await pr.blob();
                            if (photoUrl) URL.revokeObjectURL(photoUrl);
                            setPhotoUrl(URL.createObjectURL(blob));
                        }
                    } catch {}
                }
            }
        } catch {}
        setPhotoLoading(false);
    };

    useEffect(() => { fetchList(); }, [companyId, preSelectInspectionId]);

    const updateTask = async (id: string, status: string) => {
        setUpdating(true);
        try {
            const res = await authFetch(`/api/inspections/${id}/update-task`, {
                method: 'POST',
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (data.ok) {
                setSelected(data.inspection);
                fetchList();
            }
        } catch {}
        setUpdating(false);
    };

    const filtered = filter === 'all' ? inspections
        : inspections.filter(i => i.task?.status === filter);

    const counts = {
        all: inspections.length,
        pendiente: inspections.filter(i => i.task?.status === 'pendiente').length,
        en_progreso: inspections.filter(i => i.task?.status === 'en_progreso').length,
        resuelto: inspections.filter(i => i.task?.status === 'resuelto').length,
    };

    const filters = [
        { key: 'all', label: 'Todas', count: counts.all },
        { key: 'pendiente', label: 'Pendientes', count: counts.pendiente },
        { key: 'en_progreso', label: 'En progreso', count: counts.en_progreso },
        { key: 'resuelto', label: 'Resueltas', count: counts.resuelto },
    ];

    if (selected) {
        const ins = selected;
        const maxLevel = (ins.risks || []).reduce((h: string, r: any) => {
            const o: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
            return (o[r.level] || 0) > (o[h] || 0) ? r.level : h;
        }, 'bajo');
        const ls = LEVEL_STYLE[maxLevel] || LEVEL_STYLE.medio;
        const ts = STATUS_STYLE[ins.task?.status] || STATUS_STYLE.pendiente;

        return (
            <div className="space-y-5">
                <button onClick={() => {
                    setSelected(null);
                    if (photoUrl) {
                        URL.revokeObjectURL(photoUrl);
                        setPhotoUrl(null);
                    }
                    if (onBack) onBack();
                }} className="flex items-center gap-1 text-blue-400 text-sm font-semibold hover:text-blue-300">
                    <ArrowLeft className="w-4 h-4" /> {onBack ? 'Volver al panel' : 'Volver al listado'}
                </button>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-3">
                        <Building2 className="w-3 h-3" /> {ins.companyName || 'Empresa Inspeccionada'}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            {/* Banner de alerta si hay riesgos altos */}
                            {maxLevel === 'alto' && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 mb-3">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    {(ins.risks || []).filter((r: any) => r.level === 'alto').length} riesgo{(ins.risks || []).filter((r: any) => r.level === 'alto').length !== 1 ? 's' : ''} de nivel ALTO — requiere acción inmediata
                                </div>
                            )}
                            {/* Título legible: Planta + Sector */}
                            <div className="text-lg font-bold text-white">
                                {ins.plant}{ins.sector && ins.sector !== 'Sin especificar' ? ` · ${ins.sector}` : ''}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Inspector: {ins.operator} · {new Date(ins.createdAt).toLocaleString('es-AR', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </div>
                            <div className="text-[10px] text-slate-700 mt-0.5 font-mono">
                                #{ins.inspectionId?.substring(0, 8)}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ls.bg} ${ls.border} ${ls.color}`}>{ls.label}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${ts.bg} ${ts.border} ${ts.color}`}>
                                <ts.Icon className="w-3 h-3" /> {ts.label}
                            </span>
                        </div>
                    </div>
                </div>

                {photoLoading ? (
                    <div className="flex items-center justify-center h-48 bg-slate-900/30 border border-slate-800 rounded-xl">
                        <div className="text-center">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                            <p className="text-[10px] text-slate-600">Cargando evidencia...</p>
                        </div>
                    </div>
                ) : photoUrl ? (
                    <div className="rounded-xl overflow-hidden border border-slate-800">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-900/50 flex items-center gap-1.5 leading-none">
                            <Camera className="w-3 h-3" /> Evidencia fotográfica
                        </div>
                        <img
                            src={photoUrl}
                            alt="Evidencia fotográfica de la inspección"
                            className="w-full max-h-96 object-contain bg-black/40 cursor-zoom-in"
                            onClick={() => window.open(photoUrl, '_blank')}
                            onError={(e) => {
                                console.error('Image render error');
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-32 bg-slate-900/20 border border-dashed border-slate-800 rounded-xl">
                        <div className="text-center">
                            <Camera className="w-5 h-5 text-slate-700 mx-auto mb-1" />
                            <p className="text-[10px] text-slate-600">Sin evidencia fotográfica</p>
                        </div>
                    </div>
                )}

                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hallazgos e IA</h3>
                <div className="space-y-2">
                    {(ins.risks || []).map((r: any, i: number) => {
                        const rl = LEVEL_STYLE[r.level] || LEVEL_STYLE.medio;
                        return (
                            <div key={i} className="flex items-center gap-3 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                                    <CategoryIcon category={r.category} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white font-bold">{r.description}</div>
                                    {r.recommendation && (
                                        <div className="text-xs text-blue-400 mt-1 flex items-start gap-1.5">
                                            <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>{r.recommendation}</span>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${rl.bg} ${rl.border} ${rl.color}`}>{rl.label}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Plan de Acción</h3>
                    <div className="space-y-4">
                        <div className="text-sm text-slate-300 font-medium">{ins.task?.action}</div>
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                            <div><div className="text-[10px] text-slate-600 uppercase">Responsable</div><div className="text-xs text-slate-300 font-bold">{ins.task?.responsible}</div></div>
                            <div><div className="text-[10px] text-slate-600 uppercase">Prioridad</div><div className={ls.color + ' text-xs font-bold uppercase'}>{maxLevel}</div></div>
                        </div>
                        
                        {ins.task?.status !== 'resuelto' && (
                            <div className="flex gap-2">
                                {ins.task?.status === 'pendiente' && (
                                    <button onClick={() => updateTask(ins.inspectionId, 'en_progreso')} disabled={updating}
                                        className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-600/10 flex items-center justify-center gap-2">
                                        <PlayCircle className="w-4 h-4" />
                                        {updating ? 'ACTUALIZANDO...' : 'MARCAR EN PROGRESO'}
                                    </button>
                                )}
                                <button onClick={() => updateTask(ins.inspectionId, 'resuelto')} disabled={updating}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    {updating ? 'MARCANDO...' : 'FINALIZAR TAREA'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <button onClick={async () => {
                    const res = await authFetch(`/api/inspections/${ins.inspectionId}/pdf`);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `reporte-${ins.inspectionId.substring(0,8)}.pdf`; a.click();
                }} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs border border-slate-700 transition-all flex items-center justify-center gap-2">
                    <FileDown className="w-4 h-4" /> Generar Acta PDF
                </button>

                {user?.role === 'admin' && (
                    <button onClick={async () => {
                        if (!window.confirm('¿Eliminar esta inspección de forma permanente?')) return;
                        setUpdating(true);
                        try {
                            const res = await authFetch(`/api/inspections/${ins.inspectionId}`, { method: 'DELETE' });
                            if (res.ok) {
                                setSelected(null);
                                fetchList();
                            } else {
                                alert('Error al eliminar');
                            }
                        } catch {
                            alert('Error de red al eliminar');
                        }
                        setUpdating(false);
                    }} disabled={updating}
                    className="w-full py-3 bg-red-900/10 hover:bg-red-900/30 text-red-400 font-bold rounded-xl text-xs border border-red-900/30 transition-all flex items-center justify-center gap-2 mt-3">
                        <Trash2 className="w-4 h-4" /> Eliminar Inspección
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-400" /> Historial
                </h2>
                <button onClick={fetchList} className="text-slate-400 hover:text-white p-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar justify-between">
                <div className="flex gap-2">
                    {filters.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-2 ${filter === f.key
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                            {f.label}
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${filter === f.key ? 'bg-blue-500/20' : 'bg-slate-800/80'}`}>
                                {f.count}
                            </span>
                        </button>
                    ))}
                </div>
                
                <button
                    onClick={handleExportCSV}
                    disabled={filtered.length === 0}
                    className="shrink-0 whitespace-nowrap px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold border border-emerald-500 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                    <FileDown className="w-3.5 h-3.5" /> Exportar a Excel
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
                    <ClipboardList className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No se encontraron registros</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((ins: any) => {
                        const maxLevel = (ins.risks || []).reduce((h: string, r: any) => {
                            const o: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
                            return (o[r.level] || 0) > (o[h] || 0) ? r.level : h;
                        }, 'bajo');
                        const ts = STATUS_STYLE[ins.task?.status] || STATUS_STYLE.pendiente;

                        return (
                            <div key={ins.inspectionId} onClick={() => loadInspectionDetail(ins)}
                                className="flex items-center gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-800/40 transition-all group"
                                style={{ borderLeftWidth: 4, borderLeftColor: maxLevel === 'alto' ? '#EF4444' : maxLevel === 'medio' ? '#F59E0B' : '#22C55E' }}>
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800 font-mono text-[10px] text-slate-500">
                                    #{ins.inspectionId?.substring(0, 4)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">{ins.companyName}</span>
                                        {(ins.risks || []).some((r: any) => r.level === 'alto') && (
                                            <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                                                <AlertTriangle className="w-2.5 h-2.5" /> ALTO
                                            </span>
                                        )}
                                        <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${ts.bg} ${ts.border} ${ts.color}`}>
                                            <ts.Icon className="w-2.5 h-2.5" /> {ts.label}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 uppercase font-bold tracking-tight">
                                        {ins.plant}
                                        {ins.sector && ins.sector !== 'Sin especificar' && (
                                            <><span className="opacity-30">|</span> {ins.sector}</>
                                        )}
                                        <span className="opacity-30">|</span>
                                        {new Date(ins.createdAt).toLocaleDateString('es-AR')}
                                        <span className="opacity-30">|</span>
                                        <span className="text-slate-600">{(ins.risks || []).length} riesgo{(ins.risks || []).length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {user?.role === 'admin' && (
                                        <button
                                            onClick={(e) => handleDelete(e, ins.inspectionId)}
                                            disabled={deletingId === ins.inspectionId}
                                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                                            title="Eliminar inspección"
                                        >
                                            {deletingId === ins.inspectionId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
