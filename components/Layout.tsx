import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Camera, ClipboardList, LogOut, Menu, X, Users, Building2, ChevronRight } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    currentView: string;
    onNavigate: (view: string) => void;
    selectedCompanyName?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, selectedCompanyName }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useAuth();

    const baseNavItems = [
        ...(user?.role !== 'admin' ? [{ key: 'companies', icon: Building2, label: 'Mis Empresas', color: 'text-blue-400' }] : []),
        ...(user?.role !== 'admin' ? [{ key: 'new', icon: Camera, label: 'Nueva Inspección', color: 'text-emerald-400', requiresCompany: true }] : []),
        ...(user?.role !== 'admin' ? [{ key: 'inspections', icon: ClipboardList, label: 'Inspecciones', color: 'text-amber-400', requiresCompany: true }] : []),
    ];

    const navItems = user?.role === 'admin'
        ? [...baseNavItems, { key: 'admin', icon: Users, label: 'Administración', color: 'text-purple-400' }]
        : baseNavItems;

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
            {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="h-full flex flex-col">
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            {/* Isotipo HSE */}
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: '#16a34a' }}>
                                <span className="text-white font-black text-[11px] tracking-tight leading-none">hse</span>
                            </div>
                            <div>
                                <div className="font-black text-sm leading-tight text-white tracking-wide uppercase">HSE INGENIERIA</div>
                                <div className="text-[9px] text-slate-500 tracking-wider font-medium">SafetyVision · Nodo8</div>
                            </div>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400"><X size={20} /></button>
                    </div>

                    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                        {navItems.map(item => {
                            const Icon = item.icon;
                            const active = currentView === item.key;
                            const disabled = item.requiresCompany && !selectedCompanyName;
                            
                            return (
                                <button key={item.key}
                                    onClick={() => { if (!disabled) { onNavigate(item.key); setSidebarOpen(false); } }}
                                    disabled={disabled}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                        active
                                            ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                                            : disabled
                                                ? 'opacity-30 cursor-not-allowed grayscale'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}>
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400">
                                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-300 truncate">{user?.displayName || user?.email}</div>
                                <div className="text-[10px] text-slate-600">{user?.role}</div>
                            </div>
                        </div>
                        <button onClick={logout}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors">
                            <LogOut size={14} /> Cerrar sesión
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center h-14 px-4 lg:px-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 mr-4"><Menu size={20} /></button>
                    
                    <div className="flex items-center gap-2 overflow-hidden">
                        {user?.role !== 'admin' && (
                            <>
                                <button 
                                    onClick={() => onNavigate('companies')}
                                    className="text-xs font-bold text-slate-500 hover:text-white transition-colors"
                                >
                                    EMPRESAS
                                </button>
                                {selectedCompanyName && (
                                    <>
                                        <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
                                        <span className="text-xs font-bold text-blue-400 truncate uppercase tracking-wider">
                                            {selectedCompanyName}
                                        </span>
                                    </>
                                )}
                                <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
                            </>
                        )}
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {currentView === 'admin' ? 'PANEL DE ADMINISTRACIÓN' : currentView}
                        </span>
                    </div>
                </header>
                
                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </div>
            </main>
        </div>
    );
};
