import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function copyPublicPlugin(): Plugin {
  return {
    name: 'copy-public-folder',
    async closeBundle() {
      const src = path.resolve(__dirname, 'public');
      const dest = path.resolve(__dirname, 'dist/public');
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        
        // Obfuscate JS files in dist/public after copying
        try {
          const JavaScriptObfuscator = (await import('javascript-obfuscator')).default;
          function obfuscateDirectory(dir: string) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const fullPath = path.join(dir, file);
              if (fs.statSync(fullPath).isDirectory()) {
                obfuscateDirectory(fullPath);
              } else if (fullPath.endsWith('.js')) {
                const code = fs.readFileSync(fullPath, 'utf8');
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
                  compact: true,
                  controlFlowFlattening: true,
                  controlFlowFlatteningThreshold: 0.75,
                  numbersToExpressions: true,
                  simplify: true,
                  stringArrayShuffle: true,
                  splitStrings: true,
                  stringArrayThreshold: 0.75,
                  deadCodeInjection: false,
                }).getObfuscatedCode();
                fs.writeFileSync(fullPath, obfuscatedCode);
              }
            }
          }
          console.log("Obfuscating game code in dist/public/js...");
          obfuscateDirectory(path.resolve(__dirname, 'dist/public/js'));
          console.log("Obfuscation complete.");
        } catch (e) {
          console.error("Failed to obfuscate code:", e);
        }
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
