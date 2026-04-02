import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle, Send, FileText, Building2 } from 'lucide-react';

const RISK_META: Record<string, { color: string; bg: string; label: string }> = {
    alto: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'ALTO' },
    medio: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'MEDIO' },
    bajo: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'BAJO' },
};

const CAT_ICONS: Record<string, string> = { epp: '🦺', condiciones: '🏭', comportamiento: '🚧' };

interface Props {
    onComplete: () => void;
    selectedCompanyId?: string;
}

export const NewInspection: React.FC<Props> = ({ onComplete, selectedCompanyId }) => {
    const { authFetch, user } = useAuth();
    const fileRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'form' | 'analyzing' | 'results'>('form');
    const [companyId, setCompanyId] = useState(selectedCompanyId || '');
    const [companyName, setCompanyName] = useState('');
    const [plant, setPlant] = useState('');
    const [sector, setSector] = useState('');
    const [operator, setOperator] = useState(user?.displayName || '');
    const [description, setDescription] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState('image/jpeg');
    const [risks, setRisks] = useState<any[]>([]);
    const [originalRisks, setOriginalRisks] = useState<any[]>([]);
    const [aiModel, setAiModel] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    
    const [companies, setCompanies] = useState<any[]>([]);
    const [plants, setPlants] = useState<{ name: string; sectors: string[] }[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);

    // Cargar empresas si no hay una seleccionada
    useEffect(() => {
        const loadCompanies = async () => {
            try {
                const res = await authFetch('/api/companies/list');
                const data = await res.json();
                if (data.ok) {
                    setCompanies(data.companies || []);
                    if (selectedCompanyId) {
                        const found = data.companies.find((c: any) => c.companyId === selectedCompanyId);
                        if (found) setCompanyName(found.name);
                    }
                }
            } catch (err) { console.error(err); }
            setLoadingCompanies(false);
        };
        loadCompanies();
    }, [selectedCompanyId]);

    // Cargar plantas de la empresa seleccionada
    useEffect(() => {
        if (!companyId) return;
        const loadPlants = async () => {
            try {
                const res = await authFetch(`/api/companies/${companyId}`);
                const data = await res.json();
                if (data.ok && data.company) {
                    setPlants(data.company.plants || []);
                    setCompanyName(data.company.name);
                    if (data.company.plants.length > 0) setPlant(data.company.plants[0].name);
                }
            } catch (err) { console.error(err); }
        };
        loadPlants();
    }, [companyId]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setMimeType(file.type || 'image/jpeg');
        const reader = new FileReader();
        reader.onload = (ev) => {
            const full = ev.target?.result as string;
            setImagePreview(full);
            setImageBase64(full.split(',')[1]);
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        if (!companyId) { setError('Seleccioná una empresa'); return; }
        if (!plant) { setError('Seleccioná una planta'); return; }
        if (!imageBase64 && !description) { setError('Subí una foto o describí la situación'); return; }
        
        setError('');
        setStep('analyzing');

        try {
            const body: any = { plant, sector };
            if (imageBase64) {
                body.imageBase64 = imageBase64;
                body.mimeType = mimeType;
            } else {
                body.description = description;
            }

            const res = await authFetch('/api/inspections/analyze', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = await res.json();


            if (!res.ok || !data.ok) throw new Error(data.error || 'Analysis failed');

            setRisks(data.risks || []);
            setOriginalRisks(JSON.parse(JSON.stringify(data.risks || [])));
            setAiModel(data.model || 'unknown');
            setStep('results');
        } catch (err: any) {
            setError(err.message);
            setStep('form');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const highestLevel = risks.reduce((h: string, r: any) => {
                const order: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
                return (order[r.level] || 0) > (order[h] || 0) ? r.level : h;
            }, 'bajo');

            const task = {
                action: risks.map((r: any) => r.recommendation || r.description).join('; '),
                responsible: 'Supervisor de turno',
                deadline: highestLevel === 'alto' ? '4 hs' : highestLevel === 'medio' ? '24 hs' : '48 hs',
                status: 'pendiente',
            };

            const res = await authFetch('/api/inspections/create', {
                method: 'POST',
                body: JSON.stringify({
                    companyId, companyName, plant, sector, operator, risks, task,
                    imageBase64, mimeType,
                    aiAnalysis: { 
                        model: aiModel, 
                        analyzedAt: new Date().toISOString(),
                        originalRisks
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Save failed');

            setSaved(true);
            setTimeout(() => onComplete(), 1500);
        } catch (err: any) {
            setError(err.message);
        }
        setSaving(false);
    };

    if (saved) {
        return (
            <div className="max-w-md mx-auto text-center py-20">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-white mb-2">Inspección Guardada</h2>
                <p className="text-slate-500 text-sm">La tarea correctiva fue asignada para la empresa {companyName}.</p>
            </div>
        );
    }

    if (step === 'form') {
        return (
            <div className="max-w-xl mx-auto space-y-6">
                <div className="text-center">
                    <div className="text-5xl mb-2">📸</div>
                    <h2 className="text-xl font-bold text-white">Nueva Inspección</h2>
                    <p className="text-slate-500 text-sm mt-1">Realizar relevamiento de seguridad</p>
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}

                <div className="space-y-4 bg-slate-900/30 border border-slate-800 rounded-2xl p-5">
                    {/* Empresa */}
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Empresa Inspeccionada</label>
                        {selectedCompanyId ? (
                             <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 font-bold">
                                <Building2 className="w-4 h-4" /> {companyName}
                             </div>
                        ) : (
                            <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPlant(''); }}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500">
                                <option value="">Seleccionar empresa...</option>
                                {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
                            </select>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Planta</label>
                            <select value={plant} onChange={e => { setPlant(e.target.value); setSector(''); }}
                                disabled={!companyId}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-30">
                                <option value="">Seleccionar planta...</option>
                                {plants.map(p => <option key={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sector</label>
                            <select value={sector} onChange={e => setSector(e.target.value)}
                                disabled={!plant}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-30">
                                <option value="">Seleccionar sector...</option>
                                {(plants.find(p => p.name === plant)?.sectors || []).map(s =>
                                    <option key={s}>{s}</option>
                                )}
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Operador / Inspector</label>
                    <input value={operator} onChange={e => setOperator(e.target.value)} placeholder="Nombre"
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>

                <div>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
                    {imagePreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-700">
                            <img src={imagePreview} alt="preview" className="w-full max-h-64 object-cover" />
                            <button onClick={() => { setImagePreview(null); setImageBase64(null); }}
                                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs hover:bg-black/80">✕</button>
                        </div>
                    ) : (
                        <div onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-blue-500/30 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/5 transition-colors">
                            <Camera className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                            <div className="text-blue-400 font-semibold text-sm">Capturar riesgo laboral</div>
                            <div className="text-slate-500 text-xs mt-1">Tocá para iniciar cámara</div>
                        </div>
                    )}
                </div>

                <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Descripción adicional de la situación observada..."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none shadow-inner" />

                <button onClick={handleAnalyze} disabled={!companyId || (!imageBase64 && !description)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                    <Send className="w-4 h-4" /> Enviar a Gemini AI
                </button>
            </div>
        );
    }

    if (step === 'analyzing') {
        return (
            <div className="max-w-md mx-auto text-center py-20">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-6" />
                <h2 className="text-lg font-bold text-white mb-2">Evaluando Riesgos en {companyName}</h2>
                <p className="text-slate-500 text-sm">La IA de Google está analizando las condiciones laborales...</p>
            </div>
        );
    }

    const highestLevel = risks.reduce((h: string, r: any) => {
        const order: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
        return (order[r.level] || 0) > (order[h] || 0) ? r.level : h;
    }, 'bajo');

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <h2 className="text-xl font-bold text-white">Resultados del Análisis</h2>
                <p className="text-slate-500 text-sm mt-1">Empresa: {companyName} · Modelo: {aiModel}</p>
            </div>

            <div className="space-y-2">
                {risks.map((r: any, i: number) => {
                    const meta = RISK_META[r.level] || RISK_META.medio;
                    return (
                        <div key={i} className={`flex items-center gap-4 p-4 bg-slate-900 border rounded-xl ${meta.bg}`}
                            style={{ borderLeftWidth: 4, borderLeftColor: r.level === 'alto' ? '#EF4444' : r.level === 'medio' ? '#F59E0B' : '#22C55E' }}>
                            <span className="text-2xl">{CAT_ICONS[r.category] || '⚠️'}</span>
                            <div className="flex-1">
                                <div className="text-sm text-white font-bold">{r.description}</div>
                                {r.recommendation && <div className="text-xs text-blue-400 mt-1">💡 {r.recommendation}</div>}
                            </div>
                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        </div>
                    );
                })}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Tarea de Mitigación
                </h4>
                <div className="space-y-3">
                    <div className="text-sm text-slate-300 font-medium">Asunto: {risks.map((r: any) => r.description).slice(0, 2).join('; ') + (risks.length > 2 ? '...' : '')}</div>
                    <div className="flex gap-4">
                        <div>
                            <div className="text-[10px] text-slate-600 uppercase">Prioridad</div>
                            <div className={RISK_META[highestLevel]?.color + ' text-xs font-bold uppercase'}>{highestLevel}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-600 uppercase">Tiempo Máximo</div>
                            <div className="text-xs text-slate-300 font-bold">{highestLevel === 'alto' ? '4 hs' : highestLevel === 'medio' ? '24 hs' : '48 hs'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <button onClick={handleSave} disabled={saving}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                CONFIRMAR E INFORMAR
            </button>
        </div>
    );
};
