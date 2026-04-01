import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { NewInspection } from './components/NewInspection';
import { InspectionsList } from './components/InspectionsList';
import { AdminPanel } from './components/AdminPanel';
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
    const [currentView, setCurrentView] = useState('dashboard');
    const { user, isLoading } = useAuth();

    if (isLoading) return <FullScreenSpinner />;
    if (!user) return <LoginScreen />;

    return (
        <Layout currentView={currentView} onNavigate={setCurrentView}>
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'new' && (
                <NewInspection onComplete={() => setCurrentView('inspections')} />
            )}
            {currentView === 'inspections' && <InspectionsList />}
            {currentView === 'admin' && <AdminPanel />}
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
