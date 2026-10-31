import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  build: { target: 'es2022', sourcemap: true },
  server: { port: 5173 },
  test: { environment: 'node', css: false, testTimeout: 20_000 },
});
