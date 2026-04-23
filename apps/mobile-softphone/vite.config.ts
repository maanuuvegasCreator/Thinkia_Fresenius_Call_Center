import path from 'path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.join(repoRoot, 'src'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
