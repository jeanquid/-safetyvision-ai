import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Building2, Plus, X, Loader2, AlertCircle,
    CheckCircle, ArrowLeft, MapPin, Phone, User, FileText
} from 'lucide-react';

interface Props {
    onComplete: (companyId: string, companyName: string) => void;
    onCancel: () => void;
}

export const NewCompanyForm: React.FC<Props> = ({ onComplete, onCancel }) => {
    const { authFetch } = useAuth();

    // Company info
    const [name, setName] = useState('');
    const [rut, setRut] = useState('');
    const [address, setAddress] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [notes, setNotes] = useState('');

    // Plants
    const [plants, setPlants] = useState<{ name: string; sectors: string[] }[]>([
        { name: 'Planta Principal', sectors: ['General'] }
    ]);
    const [newPlantName, setNewPlantName] = useState('');
    const [newPlantSectors, setNewPlantSectors] = useState('');

    // State
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [createdCompany, setCreatedCompany] = useState<{ id: string; name: string } | null>(null);

    const handleAddPlant = () => {
        if (!newPlantName.trim()) {
            setError('Ingresá el nombre de la planta');
            return;
        }
        const sectors = newPlantSectors
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        if (sectors.length === 0) {
            setError('Agregá al menos un sector (separados por coma)');
            return;
        }
        if (plants.some(p => p.name.toLowerCase() === newPlantName.trim().toLowerCase())) {
            setError('Ya existe una planta con ese nombre');
            return;
        }

        setPlants(prev => [...prev, { name: newPlantName.trim(), sectors }]);
        setNewPlantName('');
        setNewPlantSectors('');
        setError('');
    };

    const handleRemovePlant = (plantName: string) => {
        if (plants.length <= 1) {
            setError('Debe haber al menos una planta');
            return;
        }
        setPlants(prev => prev.filter(p => p.name !== plantName));
    };

    const handleRemoveSector = (plantName: string, sectorName: string) => {
        setPlants(prev => prev.map(p => {
            if (p.name !== plantName) return p;
            const newSectors = p.sectors.filter(s => s !== sectorName);
            if (newSectors.length === 0) return p; // No permitir planta sin sectores
            return { ...p, sectors: newSectors };
        }));
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('El nombre de la empresa es obligatorio');
            return;
        }
        if (plants.length === 0) {
            setError('Agregá al menos una planta');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const res = await authFetch('/api/companies/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    rut: rut.trim() || undefined,
                    address: address.trim() || undefined,
                    contactName: contactName.trim() || undefined,
                    contactPhone: contactPhone.trim() || undefined,
                    plants,
                    notes: notes.trim() || undefined,
                }),
            });
            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Error al crear la empresa');
            }

            setCreatedCompany({ id: data.company.companyId, name: data.company.name });
            setSaved(true);

            // Después de 1.5s, navegar a la empresa creada
            setTimeout(() => {
                onComplete(data.company.companyId, data.company.name);
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        }
        setSaving(false);
    };

    // Success state
    if (saved && createdCompany) {
        return (
            <div className="max-w-md mx-auto text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Empresa creada</h2>
                <p className="text-slate-500 text-sm">
                    <span className="text-white font-semibold">{createdCompany.name}</span> fue registrada
                    con {plants.length} planta{plants.length !== 1 ? 's' : ''}.
                    Redirigiendo...
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <button onClick={onCancel}
                    className="flex items-center gap-1 text-blue-400 text-sm font-semibold hover:text-blue-300 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Volver al listado
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Nueva empresa a inspeccionar</h2>
                        <p className="text-slate-500 text-sm">Registrá los datos de la empresa cliente y sus plantas</p>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Datos de la empresa */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Datos de la empresa</h3>

                <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                        Nombre de la empresa *
                    </label>
                    <input value={name} onChange={e => setName(e.target.value)}
                        placeholder="Ej: Metalúrgica San Martín SA"
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            CUIT / RUT
                        </label>
                        <input value={rut} onChange={e => setRut(e.target.value)}
                            placeholder="30-12345678-9"
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            Dirección
                        </label>
                        <input value={address} onChange={e => setAddress(e.target.value)}
                            placeholder="Av. Industrial 1234, Buenos Aires"
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            Contacto (nombre)
                        </label>
                        <input value={contactName} onChange={e => setContactName(e.target.value)}
                            placeholder="Juan Pérez"
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            Teléfono de contacto
                        </label>
                        <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                            placeholder="+54 11 1234-5678"
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                        Notas internas
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="Observaciones, tipo de industria, horarios de acceso..."
                        rows={2}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
            </div>

            {/* Plantas y sectores */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Plantas y sectores ({plants.length})
                </h3>
                <p className="text-xs text-slate-600">
                    Definí las plantas de esta empresa. Los inspectores verán estas opciones al crear inspecciones.
                </p>

                {/* Plantas existentes */}
                {plants.map((plant) => (
                    <div key={plant.name} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-sm font-semibold text-white">{plant.name}</span>
                            </div>
                            {plants.length > 1 && (
                                <button onClick={() => handleRemovePlant(plant.name)}
                                    className="text-slate-600 hover:text-red-400 text-[10px] font-semibold transition-colors">
                                    Eliminar
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {plant.sectors.map(sector => (
                                <span key={sector}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 text-slate-300 text-[11px] rounded-md">
                                    {sector}
                                    {plant.sectors.length > 1 && (
                                        <button onClick={() => handleRemoveSector(plant.name, sector)}
                                            className="text-slate-500 hover:text-red-400 ml-0.5">×</button>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Agregar planta */}
                <div className="border border-dashed border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-semibold text-slate-500">Agregar planta</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={newPlantName} onChange={e => setNewPlantName(e.target.value)}
                            placeholder="Nombre de la planta"
                            onKeyDown={e => { if (e.key === 'Enter') handleAddPlant(); }}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                        <input value={newPlantSectors} onChange={e => setNewPlantSectors(e.target.value)}
                            placeholder="Sectores separados por coma"
                            onKeyDown={e => { if (e.key === 'Enter') handleAddPlant(); }}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <button onClick={handleAddPlant}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/15 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-semibold hover:bg-blue-600/25 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Agregar planta
                    </button>
                </div>
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={saving || !name.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                {saving ? 'Creando empresa...' : 'Crear empresa'}
            </button>
        </div>
    );
};
