import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function copyPublicPlugin(): Plugin {
  return {
    name: 'copy-public-folder',
    closeBundle() {
      const src = path.resolve(__dirname, 'public');
      const dest = path.resolve(__dirname, 'dist/public');
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
      }
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), copyPublicPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      cssMinify: 'esbuild' as const,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
