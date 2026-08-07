import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

function copyPublicPlugin(): Plugin {
  return {
    name: 'copy-public-folder',

    transformIndexHtml(html) {
      return html.replace(
        'public/js/loader.js',
        './public/js/game-bundle.js'
      );
    },

    async closeBundle() {
      const projectRoot = __dirname;
      const src = path.resolve(projectRoot, 'public');
      const dest = path.resolve(projectRoot, 'dist/public');

      if (!fs.existsSync(src)) {
        console.warn('public folder not found:', src);
        return;
      }

      // Copy the public folder first.
      fs.cpSync(src, dest, { recursive: true });

      try {
        // ------------------------------------------------------------
        // 1. Read loader.js and extract every .js file in its order
        // ------------------------------------------------------------
        const loaderPath = path.resolve(
          projectRoot,
          'public/js/loader.js'
        );

        if (!fs.existsSync(loaderPath)) {
          throw new Error(`loader.js not found: ${loaderPath}`);
        }

        const loaderContent = fs.readFileSync(loaderPath, 'utf8');

        const scriptPaths: string[] = [];

        // Supports both:
        //   'public/js/file.js'
        //   "public/js/file.js"
        // and paths beginning with / or ./.
        const regex = /["']([^"']+\.js)["']/g;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(loaderContent)) !== null) {
          const scriptPath = match[1].trim();

          if (!scriptPath) {
            continue;
          }

          // Avoid duplicates while preserving loader.js order.
          if (!scriptPaths.includes(scriptPath)) {
            scriptPaths.push(scriptPath);
          }
        }

        console.log('========================================');
        console.log('Scripts found in loader.js:');
        console.log(scriptPaths);
        console.log('========================================');

        if (scriptPaths.length === 0) {
          throw new Error(
            'No JavaScript files were found in public/js/loader.js'
          );
        }

        // ------------------------------------------------------------
        // 2. Concatenate all JS files in loader order
        // ------------------------------------------------------------
        let bundledCode = '';
        let bundledCount = 0;

        for (const sp of scriptPaths) {
          // Remove leading ./ or / so path.resolve() stays inside
          // the project directory.
          const cleanPath = sp
            .replace(/^\.?[\\/]+/, '')
            .replace(/^\/+/, '');

          const fullPath = path.resolve(projectRoot, cleanPath);

          if (!fs.existsSync(fullPath)) {
            console.warn(`NOT FOUND: ${sp}`);
            console.warn(`Resolved path: ${fullPath}`);
            continue;
          }

          const fileContent = fs.readFileSync(fullPath, 'utf8');

          bundledCode +=
            `\n/* ================================================== */\n` +
            `/* File: ${sp} */\n` +
            `/* ================================================== */\n` +
            fileContent +
            '\n;\n';

          bundledCount++;

          console.log(`Bundled: ${sp}`);
        }

        console.log('========================================');
        console.log(
          `Bundle complete: ${bundledCount}/${scriptPaths.length} files`
        );
        console.log('========================================');

        // ------------------------------------------------------------
        // 3. Obfuscate the final bundle
        // ------------------------------------------------------------
        let outputCode = bundledCode;

        try {
          const JavaScriptObfuscator = (
            await import('javascript-obfuscator')
          ).default;

          console.log(
            'Obfuscating bundled game code (this may take a moment)...'
          );

          outputCode = JavaScriptObfuscator.obfuscate(
            bundledCode,
            {
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.75,
              numbersToExpressions: true,
              simplify: true,
              stringArrayShuffle: true,
              splitStrings: true,
              stringArrayThreshold: 0.75,
              deadCodeInjection: false,
            }
          ).getObfuscatedCode();

          console.log('Obfuscation complete.');
        } catch (obfErr) {
          console.warn(
            'javascript-obfuscator not available or failed. ' +
            'Using bundled code without obfuscation.',
            obfErr
          );
        }

        // ------------------------------------------------------------
        // 4. Remove individual JS files from dist
        // ------------------------------------------------------------
        const distJsPath = path.resolve(
          projectRoot,
          'dist/public/js'
        );

        fs.rmSync(distJsPath, {
          recursive: true,
          force: true,
        });

        fs.mkdirSync(distJsPath, {
          recursive: true,
        });

        // ------------------------------------------------------------
        // 5. Write final bundle
        // ------------------------------------------------------------
        const bundlePath = path.join(
          distJsPath,
          'game-bundle.js'
        );

        fs.writeFileSync(
          bundlePath,
          outputCode,
          'utf8'
        );

        console.log('========================================');
        console.log('Game bundle created:');
        console.log(bundlePath);
        console.log('Original JS files removed from dist.');
        console.log('========================================');
      } catch (e) {
        console.error(
          'Failed to bundle/obfuscate code:',
          e
        );

        throw e;
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',

    plugins: [
      react(),
      copyPublicPlugin(),
    ],

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

      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {},
    },
  };
});
