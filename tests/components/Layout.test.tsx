import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from '../../components/Layout';

const mockLogout    = vi.fn();
const mockNavigate  = vi.fn();
const mockUseAuth   = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

const adminUser = {
    id: 'u1',
    email: 'admin@test.com',
    role: 'admin',
    tenantId: 'tenant-001',
    displayName: 'Test Admin',
};

const inspectorUser = {
    id: 'u2',
    email: 'inspector@test.com',
    role: 'inspector',
    tenantId: 'tenant-001',
    displayName: 'Test Inspector',
};

function baseAuth(user: any) {
    return { user, isLoading: false, login: vi.fn(), logout: mockLogout, authFetch: vi.fn() };
}

describe('Layout — admin', () => {
    beforeEach(() => {
        mockUseAuth.mockReturnValue(baseAuth(adminUser));
        mockLogout.mockClear();
        mockNavigate.mockClear();
    });

    it('muestra el ítem "Administración" en la nav', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Administración')).toBeInTheDocument();
    });

    it('muestra el ítem "Gestor de Inspecciones" en la nav', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Gestor de Inspecciones')).toBeInTheDocument();
    });

    it('no muestra "Mis Empresas" para admin', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.queryByText('Mis Empresas')).not.toBeInTheDocument();
    });

    it('muestra el nombre del usuario en el sidebar', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Test Admin')).toBeInTheDocument();
    });

    it('muestra el botón de cerrar sesión', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
    });

    it('llama a logout al hacer clic en cerrar sesión', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        fireEvent.click(screen.getByText('Cerrar sesión'));
        expect(mockLogout).toHaveBeenCalledOnce();
    });

    it('muestra "PANEL DE ADMINISTRACIÓN" en el header cuando currentView es admin', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('PANEL DE ADMINISTRACIÓN')).toBeInTheDocument();
    });

    it('muestra "GESTOR DE INSPECCIONES" en el header cuando currentView es gestor', () => {
        render(<Layout currentView="gestor" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('GESTOR DE INSPECCIONES')).toBeInTheDocument();
    });

    it('navega al hacer clic en un ítem de nav', () => {
        render(<Layout currentView="admin" onNavigate={mockNavigate}><div /></Layout>);
        fireEvent.click(screen.getByText('Gestor de Inspecciones'));
        expect(mockNavigate).toHaveBeenCalledWith('gestor');
    });
});

describe('Layout — inspector', () => {
    beforeEach(() => {
        mockUseAuth.mockReturnValue(baseAuth(inspectorUser));
        mockNavigate.mockClear();
    });

    it('muestra "Mis Empresas" en la nav', () => {
        render(<Layout currentView="companies" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Mis Empresas')).toBeInTheDocument();
    });

    it('muestra "Nueva Inspección" en la nav', () => {
        render(<Layout currentView="companies" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Nueva Inspección')).toBeInTheDocument();
    });

    it('muestra "Inspecciones Programadas" en la nav', () => {
        render(<Layout currentView="companies" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.getByText('Inspecciones Programadas')).toBeInTheDocument();
    });

    it('no muestra ítems exclusivos de admin', () => {
        render(<Layout currentView="companies" onNavigate={mockNavigate}><div /></Layout>);
        expect(screen.queryByText('Administración')).not.toBeInTheDocument();
        expect(screen.queryByText('Gestor de Inspecciones')).not.toBeInTheDocument();
    });
});
