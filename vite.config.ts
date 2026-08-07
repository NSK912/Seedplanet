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
        
        // Minify JS files in dist/public after copying
        try {
          const { minify: terserMinify } = await import('terser');
          
          // 1. Read loader.js to get the order
          const loaderPath = path.resolve(__dirname, 'public/js/loader.js');
          let loaderContent = fs.readFileSync(loaderPath, 'utf8');
          
          // Extract paths
          const scriptPaths: string[] = [];
          const regex = /["']([^"']+)["']/g;
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
          
          console.log("Minifying bundled game code (this may take a moment)...");
          const minified = await terserMinify(bundledCode, {
            compress: true,
            mangle: true
          });
          const finalCode = minified.code || bundledCode;
          
          // 3. Cleanup the dist/public/js directory to remove individual files
          const distJsPath = path.resolve(__dirname, 'dist/public/js');
          fs.rmSync(distJsPath, { recursive: true, force: true });
          fs.mkdirSync(distJsPath, { recursive: true });
          
          // 4. Save bundled code
          const bundlePath = path.join(distJsPath, 'game-bundle.js');
          fs.writeFileSync(bundlePath, finalCode);
          
          // 5. Update index.html
          const indexPath = path.resolve(__dirname, 'dist/index.html');
          if (fs.existsSync(indexPath)) {
            let indexHtml = fs.readFileSync(indexPath, 'utf8');
            indexHtml = indexHtml.replace(/<script[^>]*src=["']?\/?public\/js\/loader\.js["']?[^>]*><\/script>/g, '<script src="./public/js/game-bundle.js"></script>');
            
            // Minify HTML to hide internals
            try {
              const { minify } = await import('html-minifier-terser');
              indexHtml = await minify(indexHtml, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true,
                removeAttributeQuotes: true
              });
              console.log("HTML minified successfully.");
            } catch (minifyError) {
              console.error("Failed to minify HTML:", minifyError);
            }

            fs.writeFileSync(indexPath, indexHtml);
          }
          
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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
