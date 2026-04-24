import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginScreen } from '../../components/LoginScreen';

const mockLogin = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        login: mockLogin,
        user: null,
        isLoading: false,
        logout: vi.fn(),
        authFetch: vi.fn(),
    }),
}));

describe('LoginScreen', () => {
    beforeEach(() => {
        mockLogin.mockClear();
    });

    it('renderiza el campo de email', () => {
        render(<LoginScreen />);
        expect(screen.getByPlaceholderText('usuario@hse-ingenieria.com')).toBeInTheDocument();
    });

    it('renderiza el campo de contraseña', () => {
        render(<LoginScreen />);
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('renderiza el botón de ingreso', () => {
        render(<LoginScreen />);
        expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    });

    it('muestra el branding HSE', () => {
        render(<LoginScreen />);
        expect(screen.getByText('hse')).toBeInTheDocument();
        expect(screen.getByText('SafetyVision AI')).toBeInTheDocument();
    });

    it('llama a login con las credenciales correctas al enviar', async () => {
        mockLogin.mockResolvedValue({ ok: true });
        render(<LoginScreen />);

        fireEvent.change(screen.getByPlaceholderText('usuario@hse-ingenieria.com'), {
            target: { value: 'admin@hse.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'pass1234' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('admin@hse.com', 'pass1234');
        });
    });

    it('muestra error cuando login falla', async () => {
        mockLogin.mockResolvedValue({ ok: false, error: 'Credenciales inválidas' });
        render(<LoginScreen />);

        fireEvent.change(screen.getByPlaceholderText('usuario@hse-ingenieria.com'), {
            target: { value: 'x@x.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'wrong' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

        await waitFor(() => {
            expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument();
        });
    });

    it('muestra mensaje de error genérico si no viene mensaje del servidor', async () => {
        mockLogin.mockResolvedValue({ ok: false });
        render(<LoginScreen />);

        fireEvent.change(screen.getByPlaceholderText('usuario@hse-ingenieria.com'), {
            target: { value: 'x@x.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'cualquier' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

        await waitFor(() => {
            expect(screen.getByText('Error de autenticación')).toBeInTheDocument();
        });
    });

    it('el botón muestra "Ingresando..." mientras carga', async () => {
        let resolveLogin!: (v: any) => void;
        mockLogin.mockReturnValue(new Promise(r => { resolveLogin = r; }));
        render(<LoginScreen />);

        fireEvent.change(screen.getByPlaceholderText('usuario@hse-ingenieria.com'), {
            target: { value: 'admin@test.com' },
        });
        fireEvent.change(screen.getByPlaceholderText('••••••••'), {
            target: { value: 'testpass123' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

        await waitFor(() => {
            expect(screen.getByText('Ingresando...')).toBeInTheDocument();
        });

        resolveLogin({ ok: true });
    });
});
