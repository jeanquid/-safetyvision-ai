import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertTriangle, CheckCircle, Clock, ChevronRight, RefreshCw, ArrowLeft, FileDown, Camera } from 'lucide-react';

const LEVEL_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    alto: { color: 'text-red-400', bg: 'bg-red-500/10', label: '🔴 ALTO' },
    medio: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: '🟡 MEDIO' },
    bajo: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '🟢 BAJO' },
};

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    pendiente: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Pendiente' },
    en_progreso: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'En progreso' },
    resuelto: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Resuelto' },
};

export const InspectionsList: React.FC = () => {
    const { authFetch } = useAuth();
    const [inspections, setInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState<any>(null);
    const [updating, setUpdating] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/inspections/list');
            const data = await res.json();
            if (data.ok) setInspections(data.inspections || []);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchList(); }, []);

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

    const filters = [
        { key: 'all', label: 'Todas' },
        { key: 'pendiente', label: 'Pendientes' },
        { key: 'en_progreso', label: 'En progreso' },
        { key: 'resuelto', label: 'Resueltas' },
    ];

    // ── DETAIL VIEW ──
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
                }} className="flex items-center gap-1 text-blue-400 text-sm font-semibold hover:text-blue-300">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </button>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="flex-1">
                        <div className="text-lg font-bold text-white">{ins.inspectionId?.substring(0, 8)}</div>
                        <div className="text-xs text-slate-500 mt-1">{ins.plant} · {ins.sector} · {ins.operator}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{new Date(ins.createdAt).toLocaleString('es-AR')}</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ls.bg} ${ls.color}`}>{ls.label}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ts.bg} ${ts.color}`}>{ts.label}</span>
                </div>

                {/* Foto de la inspección — entre la info general y los riesgos */}
                {photoLoading ? (
                    <div className="flex items-center justify-center h-48 bg-slate-900/30 border border-slate-800 rounded-xl">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    </div>
                ) : photoUrl ? (
                    <div className="rounded-xl overflow-hidden border border-slate-800">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider px-3 py-2 bg-slate-900/50 flex items-center gap-1.5">
                            <Camera className="w-3 h-3" />
                            Evidencia fotográfica
                        </div>
                        <img
                            src={photoUrl}
                            alt="Foto de inspección"
                            className="w-full max-h-80 object-contain bg-black/30 cursor-pointer"
                            onClick={() => {
                                // Abrir foto en tamaño completo
                                const w = window.open('');
                                if (w) {
                                    w.document.write(`
                                        <html><head><title>Inspección ${ins.inspectionId?.substring(0, 8)}</title>
                                        <style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;}
                                        img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head>
                                        <body><img src="${photoUrl}"/></body></html>
                                    `);
                                }
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-24 bg-slate-900/20 border border-dashed border-slate-800 rounded-xl">
                        <span className="text-xs text-slate-600">Sin evidencia fotográfica</span>
                    </div>
                )}

                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Riesgos Detectados</h3>
                <div className="space-y-2">
                    {(ins.risks || []).map((r: any, i: number) => {
                        const rl = LEVEL_STYLE[r.level] || LEVEL_STYLE.medio;
                        const rs = STATUS_STYLE[r.status] || STATUS_STYLE.pendiente;
                        return (
                            <div key={i} className="flex items-center gap-3 p-3 bg-slate-900/30 border border-slate-800 rounded-xl">
                                <span className="text-xl">{r.category === 'epp' ? '🦺' : r.category === 'condiciones' ? '🏭' : '🚧'}</span>
                                <div className="flex-1">
                                    <div className="text-sm text-white">{r.description}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{r.confidence}% confianza</div>
                                    {r.recommendation && (
                                        <div className="text-xs text-blue-400/80 mt-1 flex items-start gap-1.5">
                                            <span className="shrink-0 mt-0.5">→</span>
                                            <span>{r.recommendation}</span>
                                        </div>
                                    )}
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rl.bg} ${rl.color}`}>{rl.label}</span>
                            </div>
                        );
                    })}
                </div>

                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tarea Correctiva</h3>
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-5">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div><div className="text-slate-500 mb-0.5">Acción</div><div className="text-slate-300">{ins.task?.action}</div></div>
                        <div><div className="text-slate-500 mb-0.5">Responsable</div><div className="text-slate-300">{ins.task?.responsible}</div></div>
                        <div><div className="text-slate-500 mb-0.5">Plazo</div><div className="text-amber-400 font-bold">{ins.task?.deadline}</div></div>
                        <div><div className="text-slate-500 mb-0.5">Estado</div><span className={`${ts.color} font-bold`}>{ts.label}</span></div>
                    </div>

                    {ins.task?.status !== 'resuelto' && (
                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                            {ins.task?.status === 'pendiente' && (
                                <button onClick={() => updateTask(ins.inspectionId, 'en_progreso')} disabled={updating}
                                    className="flex-1 py-2 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold hover:bg-amber-500/25 transition-colors disabled:opacity-50">
                                    {updating ? 'Actualizando...' : 'Marcar En Progreso'}
                                </button>
                            )}
                            <button onClick={() => updateTask(ins.inspectionId, 'resuelto')} disabled={updating}
                                className="flex-1 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                                {updating ? 'Actualizando...' : '✅ Marcar Resuelto'}
                            </button>
                        </div>
                    )}
                </div>

                {/* PDF Export */}
                <button
                    onClick={async () => {
                        try {
                            const res = await authFetch(`/api/inspections/${ins.inspectionId}/pdf`);
                            if (!res.ok) throw new Error('Error generando PDF');
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `inspeccion-${ins.inspectionId.substring(0, 8)}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                        } catch (err) {
                            alert('Error al generar el PDF');
                        }
                    }}
                    className="w-full py-2.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                    <FileDown className="w-4 h-4" /> Descargar reporte PDF
                </button>
            </div>
        );
    }

    // ── LIST VIEW ──
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Inspecciones</h2>
                <button onClick={fetchList} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex gap-2">
                {filters.map(f => {
                    const count = f.key === 'all' ? inspections.length : inspections.filter(i => i.task?.status === f.key).length;
                    return (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${filter === f.key
                                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                            {f.label} <span className="ml-1 font-mono opacity-60">{count}</span>
                        </button>
                    );
                })}
            </div>

            {loading && !inspections.length ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-sm">No hay inspecciones</div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((ins: any) => {
                        const maxLevel = (ins.risks || []).reduce((h: string, r: any) => {
                            const o: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
                            return (o[r.level] || 0) > (o[h] || 0) ? r.level : h;
                        }, 'bajo');
                        const ls = LEVEL_STYLE[maxLevel];
                        const ts = STATUS_STYLE[ins.task?.status] || STATUS_STYLE.pendiente;

                        return (
                            <div key={ins.inspectionId} onClick={async () => {
                                setSelected(ins);
                                setPhotoUrl(null);
                                // Cargar detalle completo con foto resuelta
                                try {
                                    setPhotoLoading(true);
                                    const res = await authFetch(`/api/inspections/${ins.inspectionId}`);
                                    const data = await res.json();
                                    if (data.ok && data.inspection) {
                                        setSelected(data.inspection);
                                        // Si hay foto, cargarla como blob para mostrarla
                                        if (data.inspection.resolvedPhotoUrl) {
                                            const photoRes = await authFetch(data.inspection.resolvedPhotoUrl);
                                            if (photoRes.ok) {
                                                const blob = await photoRes.blob();
                                                setPhotoUrl(URL.createObjectURL(blob));
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error('Error loading inspection detail:', err);
                                }
                                setPhotoLoading(false);
                            }}
                                className="flex items-center gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors"
                                style={{ borderLeftWidth: 3, borderLeftColor: maxLevel === 'alto' ? '#EF4444' : maxLevel === 'medio' ? '#F59E0B' : '#22C55E' }}>
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg shrink-0">📸</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-bold text-white">{ins.inspectionId?.substring(0, 8)}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ls?.bg} ${ls?.color}`}>{ls?.label}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ts.bg} ${ts.color}`}>{ts.label}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                        {ins.plant} · {ins.sector} · {ins.operator} · {(ins.risks || []).length} riesgo{(ins.risks || []).length !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] text-slate-600">{new Date(ins.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</div>
                                    <div className="text-[10px] text-slate-600">{new Date(ins.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
