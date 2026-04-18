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

                    {/* Create form — mejorado */}
                    {showForm && (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5">
                            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                                <UserPlus className="w-5 h-5 text-blue-400" />
                                <h4 className="text-sm font-bold text-white">Nuevo Usuario</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Email *</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="usuario@hse-ingenieria.com"
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                    <p className="text-[9px] text-slate-600 mt-1">Será el nombre de usuario</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Contraseña * (mín. 8 caracteres)</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                    <p className="text-[9px] text-slate-600 mt-1">{newPassword.length}/8 caracteres</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Nombre completo</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Ej: Juan García"
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Rol *</label>
                                    <select
                                        value={newRole}
                                        onChange={e => setNewRole(e.target.value as any)}
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="inspector">Inspector</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            {/* Campos de firma — solo para inspectores */}
                            {newRole === 'inspector' && (
                                <div className="border-t border-slate-800 pt-5 space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                                        <Eye className="w-4 h-4 text-emerald-400" />
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                                            Datos de firma para actas de inspección
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
                                                Nombre completo (para firma)
                                            </label>
                                            <input
                                                type="text"
                                                value={newFullName}
                                                onChange={e => setNewFullName(e.target.value)}
                                                placeholder="Ej: Ing. Juan García"
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <p className="text-[9px] text-slate-600 mt-1">Aparecerá en el PDF del acta</p>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
                                                Matrícula / Habilitación
                                            </label>
                                            <input
                                                type="text"
                                                value={newLicenseNumber}
                                                onChange={e => setNewLicenseNumber(e.target.value)}
                                                placeholder="Ej: Mat. 4521 — CPSI"
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <p className="text-[9px] text-slate-600 mt-1">Número de habilitación profesional</p>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
                                                Función / Sello
                                            </label>
                                            <input
                                                type="text"
                                                value={newJobTitle}
                                                onChange={e => setNewJobTitle(e.target.value)}
                                                placeholder="Inspector de Seguridad e Higiene"
                                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex gap-2 pt-3 border-t border-slate-800">
                                <button
                                    onClick={handleCreate}
                                    disabled={creating || !newEmail || !newPassword}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    {creating ? 'Creando...' : 'Crear Usuario'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowForm(false);
                                        setNewEmail('');
                                        setNewPassword('');
                                        setNewName('');
                                        setNewRole('inspector');
                                        setNewFullName('');
                                        setNewLicenseNumber('');
                                        setNewJobTitle('Inspector de Seguridad e Higiene');
                                        setError('');
                                    }}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* User list — tabla mejorada */}
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
                            <UsersIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 text-sm font-medium">No hay usuarios registrados aún</p>
                            <p className="text-slate-600 text-xs mt-1">Creá el primero presionando "Nuevo Usuario"</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Header de tabla (solo visual, no es tabla real) */}
                            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-900/50 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <div className="col-span-1">Avatar</div>
                                <div className="col-span-3">Usuario</div>
                                <div className="col-span-2">Rol</div>
                                <div className="col-span-4">Datos</div>
                                <div className="col-span-2 text-right">Acciones</div>
                            </div>

                            {/* Rows */}
                            {users.map(u => {
                                const rs = ROLE_STYLE[u.role] || ROLE_STYLE.inspector;
                                const isCurrentUser = u.id === user?.id;

                                return (
                                    <div
                                        key={u.id}
                                        className="grid grid-cols-12 gap-3 items-center p-4 bg-slate-900/30 border border-slate-800 rounded-xl hover:bg-slate-800/40 transition-colors"
                                    >
                                        {/* Avatar */}
                                        <div className="col-span-1">
                                            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                                                {(u.display_name || u.email)[0].toUpperCase()}
                                            </div>
                                        </div>

                                        {/* Email y display name */}
                                        <div className="col-span-3 min-w-0">
                                            <div className="font-semibold text-white text-sm truncate">
                                                {u.display_name || u.email.split('@')[0]}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">{u.email}</div>
                                        </div>

                                        {/* Rol */}
                                        <div className="col-span-2">
                                            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${rs.bg} ${rs.color} whitespace-nowrap`}>
                                                {rs.label}
                                            </span>
                                        </div>

                                        {/* Datos de firma (si existe) */}
                                        <div className="col-span-4 min-w-0">
                                            {u.full_name ? (
                                                <div className="text-[11px] text-slate-400 truncate">
                                                    <div className="font-medium text-white truncate">{u.full_name}</div>
                                                    {u.license_number && (
                                                        <div className="text-[9px] text-slate-600 truncate">{u.license_number}</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-600 italic">Sin datos de firma</div>
                                            )}
                                        </div>

                                        {/* Acciones */}
                                        <div className="col-span-2 flex items-center justify-end gap-1">
                                            {isCurrentUser ? (
                                                <div className="text-[9px] text-slate-600 font-semibold">
                                                    (Tú)
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleDelete(u.id, u.email)}
                                                    disabled={deleting === u.id}
                                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={`Eliminar ${u.email}`}
                                                >
                                                    {deleting === u.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />
                                                    }
                                                </button>
                                            )}
                                        </div>
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
