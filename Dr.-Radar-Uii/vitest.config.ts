import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Focused unit/component tests for Phase 4 Step 2 (patient chat).
// Separate from vite.config.ts so the app build configuration is untouched.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
