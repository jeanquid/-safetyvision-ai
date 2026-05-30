import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle, Send, FileText, Building2, HardHat, Factory, Construction, Lightbulb, BarChart3, X, Check } from 'lucide-react';
import { IS_ENSI, ENSI_BRAND } from '../lib/config';

const ENSI_CATEGORIES = [
    'Perforación y completación',
    'Transporte y logística',
    'Instalaciones eléctricas',
    'Manejo de sustancias peligrosas',
    'Trabajo en altura',
    'Espacios confinados',
    'Mediciones ambientales',
];

const RISK_META: Record<string, { color: string; bg: string; label: string }> = {
    alto: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'ALTO' },
    medio: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'MEDIO' },
    bajo: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'BAJO' },
};

const CategoryIcon: React.FC<{ category: string; className?: string }> = ({ category, className = 'w-5 h-5' }) => {
    if (category === 'epp') return <HardHat className={className} />;
    if (category === 'condiciones') return <Factory className={className} />;
    if (category === 'comportamiento') return <Construction className={className} />;
    return <AlertTriangle className={className} />;
};

/**
 * Comprime una imagen en el navegador usando Canvas.
 * Redimensiona a maxWidth y convierte a JPEG con calidad reducida.
 * Devuelve el base64 SIN prefijo data:...
 */
function compressImageClient(
    file: File,
    maxWidth: number = 1280,
    quality: number = 0.7
): Promise<{ base64: string; mimeType: string; originalSizeKB: number; compressedSizeKB: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Calcular dimensiones manteniendo aspect ratio
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            // Dibujar en canvas redimensionado
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas not supported')); return; }
            ctx.drawImage(img, 0, 0, width, height);

            // Exportar como JPEG comprimido
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const base64 = dataUrl.split(',')[1];

            const originalSizeKB = Math.round(file.size / 1024);
            const compressedSizeKB = Math.round((base64.length * 3) / 4 / 1024);

            console.log(`[compress] ${originalSizeKB}KB → ${compressedSizeKB}KB (-${Math.round((1 - compressedSizeKB / originalSizeKB) * 100)}%)`);

            resolve({ base64, mimeType: 'image/jpeg', originalSizeKB, compressedSizeKB });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

function deriveLevelFromScore(score: number): 'bajo' | 'medio' | 'alto' {
    if (score <= 5) return 'bajo';
    if (score <= 12) return 'medio';
    return 'alto';
}

interface Props {
    onComplete: () => void;
    selectedCompanyId?: string;
}

export const NewInspection: React.FC<Props> = ({ onComplete, selectedCompanyId }) => {
    const { authFetch, user } = useAuth();
    const fileRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

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
    const [analysisStep, setAnalysisStep] = useState(0);
    const [imageWidth, setImageWidth] = useState<number | null>(null);
    const [imageHeight, setImageHeight] = useState<number | null>(null);
    const [hoveredRiskId, setHoveredRiskId] = useState<string | null>(null);
    const [showBoxes, setShowBoxes] = useState(true);
    
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

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Comprimir en el cliente antes de enviar (evita el límite de 4.5MB de Vercel)
            const compressed = await compressImageClient(file, 1280, 0.7);
            setMimeType(compressed.mimeType);
            setImageBase64(compressed.base64);
            setImagePreview(`data:${compressed.mimeType};base64,${compressed.base64}`);
        } catch (err) {
            console.error('Compression failed, using original:', err);
            // Fallback: usar la imagen original si la compresión falla
            setMimeType(file.type || 'image/jpeg');
            const reader = new FileReader();
            reader.onload = (ev) => {
                const full = ev.target?.result as string;
                setImagePreview(full);
                setImageBase64(full.split(',')[1]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!companyId) { setError('Seleccioná una empresa'); return; }
        if (!plant) { setError('Seleccioná una planta'); return; }
        if (!imageBase64 && !description) { setError('Subí una foto o describí la situación'); return; }
        
        setError('');
        setStep('analyzing');
        setAnalysisStep(0); // paso 0: comprimiendo

        try {
            const body: any = { plant, sector };
            if (imageBase64) {
                body.imageBase64 = imageBase64;
                body.mimeType = mimeType;
            } else {
                body.description = description;
            }

            setAnalysisStep(1); // paso 1: enviando a IA

            const res = await authFetch('/api/inspections/analyze', {
                method: 'POST',
                body: JSON.stringify(body),
            });

            setAnalysisStep(2); // paso 2: procesando respuesta

            const data = await res.json();

            if (!res.ok || !data.ok) throw new Error(data.error || 'Analysis failed');

            setAnalysisStep(3); // paso 3: listo
            
            // Pequeña pausa para que el usuario vea el check verde
            await new Promise(r => setTimeout(r, 600));

            const enrichedRisks = (data.risks || []).map((r: any) => {
                if (!r.assessment) {
                    const p = r.level === 'alto' ? 4 : r.level === 'medio' ? 3 : 2;
                    const c = r.level === 'alto' ? 4 : r.level === 'medio' ? 3 : 2;
                    r.assessment = {
                        probability: p,
                        consequence: c,
                        score: p * c,
                        level: r.level,
                        source: 'ai'
                    };
                }
                return r;
            });

            setRisks(enrichedRisks);
            setOriginalRisks(JSON.parse(JSON.stringify(enrichedRisks)));
            setAiModel(data.model || 'unknown');
            if (data.compression && data.compression.width && data.compression.height) {
                setImageWidth(data.compression.width);
                setImageHeight(data.compression.height);
            }
            setStep('results');
        } catch (err: any) {
            setError(err.message);
            setStep('form');
            setAnalysisStep(0);
        }
    };

    const handleAssessmentChange = (riskIndex: number, p: number, c: number) => {
        setRisks(prev => {
            const updated = [...prev];
            const risk = { ...updated[riskIndex] };
            const score = p * c;
            const derivedLevel = deriveLevelFromScore(score);
            
            risk.assessment = {
                ...risk.assessment,
                probability: p,
                consequence: c,
                score,
                level: derivedLevel,
                source: 'inspector',
                confirmedBy: user?.id || user?.userId || 'inspector',
                confirmedAt: new Date().toISOString()
            };
            risk.level = derivedLevel;
            updated[riskIndex] = risk;
            return updated;
        });
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
                    imageWidth, imageHeight,
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
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Inspección Guardada</h2>
                <p className="text-slate-500 text-sm">La tarea correctiva fue asignada para la empresa {companyName}.</p>
            </div>
        );
    }

    if (step === 'form') {
        return (
            <div className="max-w-xl mx-auto space-y-6">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-white">
                        {IS_ENSI ? 'Nueva Inspección de Campo' : 'Nueva Inspección'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {IS_ENSI
                            ? 'Subí una foto del puesto de trabajo o instalación a inspeccionar'
                            : 'Realizar relevamiento de seguridad'}
                    </p>
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
                    <div className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm text-slate-300">
                        {operator}
                    </div>
                </div>

                <div>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
                    <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                    {imagePreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-700">
                            <img src={imagePreview} alt="preview" className="w-full max-h-64 object-cover" />
                            <button onClick={() => { setImagePreview(null); setImageBase64(null); }}
                                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/80">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-blue-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500/60 hover:bg-blue-500/5 transition-colors">
                                <Camera className="w-7 h-7 text-blue-400 mx-auto mb-2" />
                                <div className="text-blue-400 font-semibold text-sm">Tomar foto</div>
                                <div className="text-slate-500 text-xs mt-1">Usar cámara</div>
                            </div>
                            <div onClick={() => galleryRef.current?.click()}
                                className="border-2 border-dashed border-purple-500/30 rounded-xl p-6 text-center cursor-pointer hover:border-purple-500/60 hover:bg-purple-500/5 transition-colors">
                                <Upload className="w-7 h-7 text-purple-400 mx-auto mb-2" />
                                <div className="text-purple-400 font-semibold text-sm">Subir imagen</div>
                                <div className="text-slate-500 text-xs mt-1">Desde galería o archivo</div>
                            </div>
                        </div>
                    )}
                </div>

                <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={IS_ENSI
                        ? 'Ej: Equipo de perforación Nro. 3 · Sector andamio · Turno mañana · Operario sin arnés detectado visualmente'
                        : 'Descripción adicional de la situación observada...'}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none shadow-inner" />

                {IS_ENSI && (
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Categoría de riesgo O&amp;G</label>
                        <select className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500">
                            <option value="">Seleccionar categoría...</option>
                            {ENSI_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                )}

                <button onClick={handleAnalyze} disabled={!companyId || (!imageBase64 && !description)}
                    className="w-full py-4 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    style={!(!companyId || (!imageBase64 && !description)) ? { backgroundColor: IS_ENSI ? ENSI_BRAND.primaryColor : '#2563eb', boxShadow: `0 10px 15px -3px ${IS_ENSI ? 'rgba(0,58,112,0.3)' : 'rgba(37,99,235,0.2)'}` } : undefined}
                    onMouseEnter={e => { if (!(!companyId || (!imageBase64 && !description))) (e.currentTarget as HTMLButtonElement).style.backgroundColor = IS_ENSI ? ENSI_BRAND.accentColor : '#3b82f6'; }}
                    onMouseLeave={e => { if (!(!companyId || (!imageBase64 && !description))) (e.currentTarget as HTMLButtonElement).style.backgroundColor = IS_ENSI ? ENSI_BRAND.primaryColor : '#2563eb'; }}
                >
                    <Send className="w-4 h-4" />
                    {IS_ENSI ? 'Analizar inspección' : 'Enviar a Gemini AI'}
                </button>
            </div>
        );
    }

    if (step === 'analyzing') {
        const steps = [
            { label: 'Comprimiendo imagen', sublabel: 'Optimizando para análisis' },
            { label: 'Enviando a Gemini AI', sublabel: 'Google procesa la imagen' },
            { label: 'Detectando riesgos', sublabel: 'Clasificando por gravedad' },
            { label: 'Análisis completo', sublabel: 'Preparando resultados' },
        ];

        return (
            <div className="max-w-sm mx-auto py-16 px-4">
                {/* Ícono animado */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            {analysisStep < 3
                                ? <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                : <CheckCircle className="w-8 h-8 text-emerald-400" />
                            }
                        </div>
                        {analysisStep < 3 && (
                            <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
                        )}
                    </div>
                </div>

                {/* Empresa */}
                <p className="text-center text-xs text-slate-500 uppercase tracking-wider mb-6">
                    {companyName} · {plant}
                </p>

                {/* Steps */}
                <div className="space-y-3">
                    {steps.map((s, i) => {
                        const isDone = analysisStep > i;
                        const isActive = analysisStep === i;
                        return (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                                isActive ? 'bg-blue-500/10 border border-blue-500/20' :
                                isDone ? 'opacity-50' : 'opacity-20'
                            }`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                                    isDone ? 'bg-emerald-500/20 text-emerald-400' :
                                    isActive ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-slate-800 text-slate-600'
                                }`}>
                                    {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${isActive ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {s.label}
                                    </div>
                                    {isActive && (
                                        <div className="text-xs text-slate-500 mt-0.5">{s.sublabel}</div>
                                    )}
                                </div>
                                {isActive && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />}
                            </div>
                        );
                    })}
                </div>
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
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                    <BarChart3 className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Resultados del Análisis</h2>
                <p className="text-slate-500 text-sm mt-1">Empresa: {companyName} · Modelo: {aiModel}</p>
            </div>

            {imagePreview && (
                <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Evidencia Visual Anotada</span>
                        <button
                            type="button"
                            onClick={() => setShowBoxes(!showBoxes)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors flex items-center gap-1"
                        >
                            {showBoxes ? 'Ocultar Cajas' : 'Mostrar Cajas'}
                        </button>
                    </div>

                    <div className="relative overflow-hidden rounded-xl border border-slate-700 mx-auto select-none bg-slate-950" style={{ maxWidth: '100%' }}>
                        <img src={imagePreview} alt="Evidencia de inspección" className="w-full h-auto block max-h-[350px] object-contain" />
                        
                        {showBoxes && risks.map((r, idx) => {
                            if (!r.bbox) return null;
                            const isHovered = hoveredRiskId === r.id;
                            const borderColors = {
                                alto: 'border-red-500 bg-red-500/10 text-red-200',
                                medio: 'border-amber-500 bg-amber-500/10 text-amber-200',
                                bajo: 'border-emerald-500 bg-emerald-500/10 text-emerald-200',
                            };
                            const colorClass = borderColors[r.level as 'bajo' | 'medio' | 'alto'] || borderColors.medio;
                            const { x, y, w, h, label } = r.bbox;

                            return (
                                <div
                                    key={r.id}
                                    onMouseEnter={() => setHoveredRiskId(r.id)}
                                    onMouseLeave={() => setHoveredRiskId(null)}
                                    className={`absolute border-2 rounded transition-all duration-200 ${colorClass} ${
                                        isHovered ? 'ring-2 ring-white scale-[1.01] border-3 z-20 shadow-lg shadow-black/50' : 'z-10'
                                    }`}
                                    style={{
                                        left: `${x * 100}%`,
                                        top: `${y * 100}%`,
                                        width: `${w * 100}%`,
                                        height: `${h * 100}%`,
                                    }}
                                >
                                    {/* Label Badge */}
                                    <div className="absolute -top-5 left-0 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-black/80 border border-slate-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] pointer-events-none">
                                        {label || r.description.substring(0, 15)}
                                    </div>
                                    
                                    {/* Delete BBox Button */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRisks(prev => {
                                                const updated = [...prev];
                                                updated[idx] = { ...updated[idx], bbox: null };
                                                return updated;
                                            });
                                        }}
                                        className="absolute -top-5 right-0 bg-red-600 hover:bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"
                                        title="Eliminar anotación"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
 
            <div className="space-y-2">
                {risks.map((r: any, i: number) => {
                    const meta = RISK_META[r.level] || RISK_META.medio;
                    return (
                        <div key={i}
                            onMouseEnter={() => setHoveredRiskId(r.id)}
                            onMouseLeave={() => setHoveredRiskId(null)}
                            className={`flex items-center gap-4 p-4 bg-slate-900 border rounded-xl transition-all ${meta.bg} ${
                                hoveredRiskId === r.id ? 'ring-2 ring-blue-500 scale-[1.005]' : ''
                            }`}
                            style={{ borderLeftWidth: 4, borderLeftColor: r.level === 'alto' ? '#EF4444' : r.level === 'medio' ? '#F59E0B' : '#22C55E' }}>== 'medio' ? '#F59E0B' : '#22C55E' }}>
                            <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                                <CategoryIcon category={r.category} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm text-white font-bold">{r.description}</div>
                                {r.recommendation && (
                                    <div className="text-xs text-blue-400 mt-1 flex items-start gap-1.5">
                                        <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span>{r.recommendation}</span>
                                    </div>
                                )}

                                {r.assessment && (
                                    <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            Matriz de Riesgo Probabilidad x Consecuencia (5x5)
                                        </div>
                                        
                                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                            <div className="grid grid-cols-5 gap-1 w-44 shrink-0">
                                                {[5, 4, 3, 2, 1].flatMap(p => 
                                                    [1, 2, 3, 4, 5].map(c => {
                                                        const score = p * c;
                                                        const lvl = deriveLevelFromScore(score);
                                                        const isSelected = r.assessment.probability === p && r.assessment.consequence === c;
                                                        
                                                        const colorClasses = 
                                                            lvl === 'alto' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/30' :
                                                            lvl === 'medio' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/30' :
                                                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30';
                                                        
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={`${p}-${c}`}
                                                                onClick={() => handleAssessmentChange(i, p, c)}
                                                                className={`h-7 w-full border rounded text-[9px] font-bold transition-all flex items-center justify-center relative ${colorClasses} ${
                                                                    isSelected ? 'ring-2 ring-blue-500 border-blue-400 scale-105 bg-blue-500/20 text-white z-10' : ''
                                                                }`}
                                                                title={`P: ${p} x C: ${c} = Score: ${score} (${lvl})`}
                                                            >
                                                                {score}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            
                                            <div className="flex-1 space-y-1 text-xs">
                                                <div className="text-slate-200 font-semibold">
                                                    Evaluación: <span className={meta.color}>{r.level.toUpperCase()}</span> (P:{r.assessment.probability} x C:{r.assessment.consequence} = {r.assessment.score})
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {r.assessment.source === 'ai' ? (
                                                        <span className="text-blue-400 font-medium">Clasificación sugerida por IA — confirmá o ajustá según tu criterio profesional</span>
                                                    ) : (
                                                        <span className="text-emerald-400 font-medium">Clasificación ajustada por el inspector</span>
                                                    )}
                                                </div>
                                                {(r.assessment.probabilityJustification || r.assessment.consequenceJustification) && (
                                                    <div className="text-[10px] text-slate-500 mt-1 italic space-y-0.5 border-l border-slate-800 pl-2">
                                                        {r.assessment.probabilityJustification && <div>Probabilidad: {r.assessment.probabilityJustification}</div>}
                                                        {r.assessment.consequenceJustification && <div>Consecuencia: {r.assessment.consequenceJustification}</div>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {r.legalBasis && (
                                    <details className="mt-2 group text-xs">
                                        <summary className="cursor-pointer text-slate-400 hover:text-slate-200 select-none flex items-center gap-1.5 font-medium transition-colors focus:outline-none">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            Fundamento: {r.legalBasis.norma} · {r.legalBasis.articleId}
                                        </summary>
                                        <div className="mt-1.5 pl-3 border-l border-blue-500/30 text-slate-300 italic leading-relaxed py-0.5">
                                            "{r.legalBasis.citation}"
                                            <span className="text-[10px] text-blue-400/80 font-bold block mt-1">Relevancia: {Math.round(r.legalBasis.relevance * 100)}%</span>
                                        </div>
                                    </details>
                                )}
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
