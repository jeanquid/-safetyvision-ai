import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Users as UsersIcon, Plus, Trash2, Loader2, AlertCircle,
    CheckCircle, Shield, Eye, UserPlus, X
} from 'lucide-react';

interface UserRecord {
    id: string;
    email: string;
    role: string;
    display_name: string;
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

    // Form state
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'inspector' | 'supervisor' | 'admin'>('inspector');
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/users');
            const data = await res.json();
            if (data.ok) setUsers(data.users || []);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

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
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Error al crear usuario');

            setSuccess(`Usuario ${newEmail} creado exitosamente`);
            setNewEmail('');
            setNewPassword('');
            setNewName('');
            setNewRole('inspector');
            setShowForm(false);
            fetchUsers();
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
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
        setDeleting(null);
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
                    <h2 className="text-xl font-bold text-white">Gestión de Usuarios</h2>
                    <p className="text-slate-500 text-sm mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''} en el sistema</p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setError(''); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showForm ? 'Cancelar' : 'Nuevo Usuario'}
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

            {/* Create form */}
            {showForm && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Crear nuevo usuario</h3>

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
                                        {isCurrentUser && (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                                                Tú
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] text-slate-600">
                                        {new Date(u.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                                {!isCurrentUser && (
                                    <button
                                        onClick={() => handleDelete(u.id, u.email)}
                                        disabled={deleting === u.id}
                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors disabled:opacity-50"
                                        title="Eliminar usuario"
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
    );
};
