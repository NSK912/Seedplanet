import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

function copyPublicPlugin(): Plugin {
  return {
    name: 'copy-public-folder',
    transformIndexHtml(html) {
      return html.replace('public/js/loader.js', './public/js/game-bundle.js');
    },
    async closeBundle() {
      const src = path.resolve(__dirname, 'public');
      const dest = path.resolve(__dirname, 'dist/public');
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        
        try {
          const JavaScriptObfuscator = (await import('javascript-obfuscator')).default;
          
          // 1. Read loader.js to get the order
          const loaderPath = path.resolve(__dirname, 'public/js/loader.js');
          let loaderContent = fs.readFileSync(loaderPath, 'utf8');
          
          // Extract paths
          const scriptPaths: string[] = [];
          const regex = /'([^']+)'/g;
          let match;
          while ((match = regex.exec(loaderContent)) !== null) {
            if (match[1].endsWith('.js')) {
              scriptPaths.push(match[1]);
            }
          }
          
          // 2. Concatenate all JS
          let bundledCode = '';
          for (const sp of scriptPaths) {
            const fullPath = path.resolve(__dirname, sp);
            if (fs.existsSync(fullPath)) {
              bundledCode += `\n/* File: ${sp} */\n` + fs.readFileSync(fullPath, 'utf8') + ';\n';
            }
          }
          
          console.log("Obfuscating bundled game code (this may take a moment)...");
          const obfuscatedCode = JavaScriptObfuscator.obfuscate(bundledCode, {
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
          
          // 3. Cleanup the dist/public/js directory to remove individual files
          const distJsPath = path.resolve(__dirname, 'dist/public/js');
          fs.rmSync(distJsPath, { recursive: true, force: true });
          fs.mkdirSync(distJsPath, { recursive: true });
          
          // 4. Save bundled code
          const bundlePath = path.join(distJsPath, 'game-bundle.js');
          fs.writeFileSync(bundlePath, obfuscatedCode);
          
          console.log("Bundle and obfuscation complete. Original JS files removed from dist.");
        } catch (e) {
          console.error("Failed to bundle/obfuscate code:", e);
          throw e;
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
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
