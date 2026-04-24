import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'node',
        environmentMatchGlobs: [
            ['tests/components/**', 'jsdom'],
        ],
        setupFiles: ['tests/setup.ts'],
        include: ['tests/**/*.test.{ts,tsx}'],
        testTimeout: 15000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: [
                'api/**/*.ts',
                'components/**/*.{ts,tsx}',
                'contexts/**/*.tsx',
                'App.tsx',
            ],
            exclude: [
                'api/_migrate.ts',
                'api/index.ts',
                'api/_types.ts',
                'api/_logger.ts',
                'api/_notify.ts',
            ],
            thresholds: {
                lines: 15,
                functions: 15,
                branches: 10,
                statements: 15,
            },
        },
    },
});
