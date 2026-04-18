import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Users as UsersIcon, Plus, Trash2, Loader2, AlertCircle,
    CheckCircle, Shield, Eye, UserPlus, X, Building
} from 'lucide-react';

interface UserRecord {
    id: string;
    email: string;
    role: string;
    display_name: string;
    full_name?: string;
    license_number?: string;
    job_title?: string;
    created_at: string;
}

export const AdminPanel: React.FC = () => {
    const { authFetch, user } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState<'users' | 'plants'>('users');
    const [tenantPlants, setTenantPlants] = useState<{ name: string; sectors: string[] }[]>([]);
    const [plantsLoading, setPlantsLoading] = useState(true);
    const [plantsSaving, setPlantsSaving] = useState(false);
    const [tenantName, setTenantName] = useState('');

    // Form state: Users
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'inspector' | 'supervisor' | 'admin'>('inspector');
    const [newName, setNewName] = useState('');
    const [newFullName, setNewFullName] = useState('');
    const [newLicenseNumber, setNewLicenseNumber] = useState('');
    const [newJobTitle, setNewJobTitle] = useState('Inspector de Seguridad e Higiene');
    const [creating, setCreating] = useState(false);

    // Form state: Plants
    const [newPlantName, setNewPlantName] = useState('');
    const [newPlantSectors, setNewPlantSectors] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setPlantsLoading(true);
        try {
            const [usersRes, configRes] = await Promise.all([
                authFetch('/api/users'),
                authFetch('/api/config')
            ]);
            
            const usersData = await usersRes.json();
            if (usersData.ok) setUsers(usersData.users || []);

            const configData = await configRes.json();
            if (configData.ok && configData.tenant) {
                setTenantPlants(configData.tenant.plants || []);
                setTenantName(configData.tenant.name || '');
            }
        } catch {}
        setLoading(false);
        setPlantsLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async () => {
        if (!newEmail || !newPassword) {
            setError('Email y contraseña son obligatorios');
            return;
        }
        if (newPassword.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        setCreating(true);
        setError('');
        try {
            const res = await authFetch('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                    email: newEmail,
                    password: newPassword,
                    role: newRole,
                    displayName: newName || newEmail.split('@')[0],
                    fullName: newFullName || undefined,
                    licenseNumber: newLicenseNumber || undefined,
                    jobTitle: newJobTitle || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Error al crear usuario');

            setSuccess(`Usuario ${newEmail} creado exitosamente`);
            setNewEmail('');
            setNewPassword('');
            setNewName('');
            setNewFullName('');
            setNewLicenseNumber('');
            setNewJobTitle('Inspector de Seguridad e Higiene');
            setNewRole('inspector');
            setShowForm(false);
            fetchData();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        }
        setCreating(false);
    };

    const handleDelete = async (userId: string, email: string) => {
        if (!confirm(`¿Eliminar al usuario ${email}? Esta acción no se puede deshacer.`)) return;

        setDeleting(userId);
        try {
            const res = await authFetch(`/api/users/${userId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Error al eliminar');
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
        setDeleting(null);
    };

    const handleAddPlant = () => {
        if (!newPlantName.trim()) {
            setError('El nombre de la planta es obligatorio');
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

        setTenantPlants(prev => [...prev, { name: newPlantName.trim(), sectors }]);
        setNewPlantName('');
        setNewPlantSectors('');
        setError('');
    };

    const handleRemovePlant = (plantName: string) => {
        setTenantPlants(prev => prev.filter(p => p.name !== plantName));
    };

    const handleRemoveSector = (plantName: string, sectorName: string) => {
        setTenantPlants(prev => prev.map(p => {
            if (p.name !== plantName) return p;
            return { ...p, sectors: p.sectors.filter(s => s !== sectorName) };
        }));
    };

    const handleAddSector = (plantName: string, sector: string) => {
        if (!sector.trim()) return;
        setTenantPlants(prev => prev.map(p => {
            if (p.name !== plantName) return p;
            if (p.sectors.includes(sector.trim())) return p;
            return { ...p, sectors: [...p.sectors, sector.trim()] };
        }));
    };

    const handleSavePlants = async () => {
        if (tenantPlants.length === 0) {
            setError('Debe haber al menos una planta');
            return;
        }
        setPlantsSaving(true);
        setError('');
        try {
            const res = await authFetch('/api/config/plants', {
                method: 'PUT',
                body: JSON.stringify({ plants: tenantPlants }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Error al guardar');
            setSuccess('Configuración de plantas guardada');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        }
        setPlantsSaving(false);
    };

    const ROLE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
        admin: { color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Admin' },
        supervisor: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Supervisor' },
        inspector: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Inspector' },
    };

    if (user?.role !== 'admin') {
        return (
            <div className="text-center py-20">
                <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-slate-400">Acceso restringido</h2>
                <p className="text-slate-600 text-sm mt-1">Solo los administradores pueden gestionar usuarios</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Panel de Administración</h2>
                    <p className="text-slate-500 text-sm mt-0.5">{tenantName || 'Gestioná tu empresa'}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-3">
                <button
                    onClick={() => { setActiveTab('users'); setError(''); setSuccess(''); }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeTab === 'users'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800 border border-transparent'
                    }`}
                >
                    <UsersIcon className="w-4 h-4" />
                    Usuarios
                </button>
                <button
                    onClick={() => { setActiveTab('plants'); setError(''); setSuccess(''); }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                        activeTab === 'plants'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800 border border-transparent'
                    }`}
                >
                    <Building className="w-4 h-4" />
                    Plantas y Sectores
                </button>
            </div>

            {/* Feedback messages */}
            {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" /> {success}
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Lista de Usuarios ({users.length})</h3>
                        <button
                            onClick={() => { setShowForm(!showForm); setError(''); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-lg hover:bg-blue-600/20 transition-all"
                        >
                            {showForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                            {showForm ? 'Cancelar' : 'Nuevo Usuario'}
                        </button>
                    </div>

                    {/* Create form */}
                    {showForm && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="usuario@empresa.com"
                                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Contraseña * (min 8 chars)</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Nombre completo"
                                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Rol</label>
                                    <select
                                        value={newRole}
                                        onChange={e => setNewRole(e.target.value as any)}
                                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="inspector">Inspector</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            {/* Campos de firma — solo visibles cuando el rol es inspector */}
                            {newRole === 'inspector' && (
                                <div className="border-t border-slate-800 pt-4 space-y-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
                                        <Eye className="w-3 h-3" /> Datos de firma para actas de inspección
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                                Nombre completo (para firma)
                                            </label>
                                            <input
                                                type="text"
                                                value={newFullName}
                                                onChange={e => setNewFullName(e.target.value)}
                                                placeholder="Ej: Ing. Juan García"
                                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                                Matrícula / N° habilitación
                                            </label>
                                            <input
                                                type="text"
                                                value={newLicenseNumber}
                                                onChange={e => setNewLicenseNumber(e.target.value)}
                                                placeholder="Ej: Mat. 4521 — CPSI"
                                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                                Función / Sello
                                            </label>
                                            <input
                                                type="text"
                                                value={newJobTitle}
                                                onChange={e => setNewJobTitle(e.target.value)}
                                                placeholder="Inspector de Seguridad e Higiene"
                                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {creating ? 'Creando...' : 'Crear Usuario'}
                            </button>
                        </div>
                    )}

                    {/* User list */}
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {users.map(u => {
                                const rs = ROLE_STYLE[u.role] || ROLE_STYLE.inspector;
                                const isCurrentUser = u.id === user?.id;

                                return (
                                    <div key={u.id}
                                        className="flex items-center gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-xl"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                                            {(u.display_name || u.email)[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-white truncate">
                                                    {u.display_name || u.email.split('@')[0]}
                                                </span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rs.bg} ${rs.color}`}>
                                                    {rs.label}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">{u.email}</div>
                                            {/* Si el usuario tiene datos de firma, mostrarlos */}
                                            {u.full_name && (
                                                <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                                                    {u.full_name}{u.license_number ? ` · ${u.license_number}` : ''}
                                                </div>
                                            )}
                                        </div>
                                        {!isCurrentUser && (
                                            <button
                                                onClick={() => handleDelete(u.id, u.email)}
                                                disabled={deleting === u.id}
                                                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {deleting === u.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Trash2 className="w-4 h-4" />
                                                }
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'plants' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Configuración Industrial</h3>
                    </div>

                    <p className="text-xs text-slate-500">
                        Configurá las plantas y sectores de tu empresa. Los inspectores verán estas opciones al crear inspecciones.
                    </p>

                    {plantsLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Plantas existentes */}
                            {tenantPlants.map((plant) => (
                                <div key={plant.name} className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3 shadow-sm">
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <Building className="w-3.5 h-3.5 text-blue-400" />
                                            {plant.name}
                                        </span>
                                        <button
                                            onClick={() => handleRemovePlant(plant.name)}
                                            className="text-slate-600 hover:text-red-400 hover:bg-red-500/5 px-2 py-1 rounded transition-colors text-[10px] font-bold"
                                        >
                                            ELIMINAR PLANTA
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {plant.sectors.map(sector => (
                                            <span key={sector}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] font-medium rounded-lg border border-slate-700">
                                                {sector}
                                                <button
                                                    onClick={() => handleRemoveSector(plant.name, sector)}
                                                    className="text-slate-500 hover:text-red-400"
                                                >×</button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            placeholder="+ Agregar sector..."
                                            className="px-2.5 py-1 bg-transparent border border-dashed border-slate-700 text-white text-[11px] rounded-lg w-32 focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddSector(plant.name, (e.target as HTMLInputElement).value);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Agregar nueva planta */}
                            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-5 space-y-3">
                                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                    <Plus className="w-3.5 h-3.5" /> Nueva Planta
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input
                                        value={newPlantName}
                                        onChange={e => setNewPlantName(e.target.value)}
                                        placeholder="Nombre de la planta (ej: Planta Sur)"
                                        className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <input
                                        value={newPlantSectors}
                                        onChange={e => setNewPlantSectors(e.target.value)}
                                        placeholder="Sectores (separados por coma)"
                                        className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <button onClick={handleAddPlant}
                                    className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold hover:bg-blue-600/30 transition-colors">
                                    Confirmar Planta
                                </button>
                            </div>

                            {/* Guardar */}
                            <button onClick={handleSavePlants} disabled={plantsSaving || tenantPlants.length === 0}
                                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10">
                                {plantsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                {plantsSaving ? 'Guardando...' : 'Aplicar Cambios a la Configuración'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
