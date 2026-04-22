import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { CompaniesView } from './components/CompaniesView';
import { Dashboard } from './components/Dashboard';
import { NewInspection } from './components/NewInspection';
import { NewCompanyForm } from './components/NewCompanyForm';
import { InspectionsList } from './components/InspectionsList';
import { AdminPanel } from './components/AdminPanel';
import GestorInspecciones from './components/GestorInspecciones';
import InspeccionesProgramadas from './components/InspeccionesProgramadas';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Loader2 } from 'lucide-react';

const FullScreenSpinner = () => (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <span className="text-slate-400 font-medium">Iniciando SafetyVision AI...</span>
    </div>
);

function AppContent() {
    const [currentView, setCurrentView] = useState('companies');
    const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
    const { user, isLoading } = useAuth();

    React.useEffect(() => {
        if (!user) return;
        if (user.role === 'admin' && (currentView === 'companies' || currentView === 'programadas')) {
            setCurrentView('admin');
        } else if (user.role !== 'admin' && (currentView === 'admin' || currentView === 'gestor')) {
            setCurrentView('companies');
        }
    }, [user, currentView]);

    if (isLoading) return <FullScreenSpinner />;
    if (!user) return <LoginScreen />;

    const handleSelectCompany = (id: string, name: string) => {
        setSelectedCompany({ id, name });
        setCurrentView('dashboard');
    };

    return (
        <Layout
            currentView={currentView}
            onNavigate={(view) => {
                if (view === 'companies') setSelectedCompany(null);
                setCurrentView(view);
            }}
            selectedCompanyName={selectedCompany?.name}
        >
            {currentView === 'companies' && (
                <CompaniesView
                    onSelectCompany={handleSelectCompany}
                    onNewCompany={() => setCurrentView('new_company')}
                />
            )}

            {currentView === 'new_company' && (
                <NewCompanyForm
                    onComplete={(companyId, companyName) => {
                        handleSelectCompany(companyId, companyName);
                    }}
                    onCancel={() => setCurrentView('companies')}
                />
            )}

            {currentView === 'dashboard' && (
                <Dashboard companyId={selectedCompany?.id} companyName={selectedCompany?.name} />
            )}

            {currentView === 'new' && (
                <NewInspection
                    selectedCompanyId={selectedCompany?.id}
                    onComplete={() => setCurrentView('inspections')}
                />
            )}

            {currentView === 'inspections' && (
                <InspectionsList companyId={selectedCompany?.id} />
            )}

            {currentView === 'admin' && (
                <AdminPanel 
                    onNewCompany={() => setCurrentView('new_company')} 
                    onSelectCompany={handleSelectCompany}
                />
            )}

            {currentView === 'gestor' && <GestorInspecciones />}

            {currentView === 'programadas' && <InspeccionesProgramadas />}
        </Layout>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
