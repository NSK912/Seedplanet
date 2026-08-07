import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function copyPublicPlugin(): Plugin {
  return {
    name: 'copy-public-folder',
    apply: 'build', // ทำงานเฉพาะตอน build เท่านั้น
    async closeBundle() {
      const src = path.resolve(__dirname, 'public');
      const dest = path.resolve(__dirname, 'dist/public');
      
      if (fs.existsSync(src)) {
        // ลบ dist/public เดิมถ้ามี
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        
        // Copy ทั้ง public folder
        fs.cpSync(src, dest, { recursive: true });
        console.log("✅ Public folder copied to dist");
        
        // Copy index.html (เก็บไว้เฉยๆ ไม่ต้อง minify)
        const htmlSrc = path.resolve(__dirname, 'index.html');
        const htmlDest = path.resolve(__dirname, 'dist/index.html');
        if (fs.existsSync(htmlSrc)) {
          // อ่านไฟล์ต้นฉบับ
          const content = fs.readFileSync(htmlSrc, 'utf8');
          // เขียนไปยัง dist โดยไม่เปลี่ยนแปลง
          fs.writeFileSync(htmlDest, content);
          console.log("✅ index.html copied (preserved)");
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
      // ป้องกัน Vite ไปยุ่งกับ HTML
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
