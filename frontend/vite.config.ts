import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import themePlugin from './theme-plugin';
export default defineConfig({
  plugins: [react()], css: { postcss: { plugins: [tailwindcss(), themePlugin()] } },
  server: { host: '127.0.0.1', port: 5175, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8002' } } },
});
