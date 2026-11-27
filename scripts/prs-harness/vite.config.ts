import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = resolve(__dirname, '../..');

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  css: { postcss: repo },
  server: { host: '127.0.0.1', strictPort: true, fs: { allow: [repo] } },
});
