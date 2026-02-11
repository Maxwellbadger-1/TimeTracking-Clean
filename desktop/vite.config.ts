import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import removeConsole from "vite-plugin-remove-console";
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ========================================
// 🔥 LAYER 1: BUILD-TIME ENV DEBUG 🔥
// ========================================
console.log('🔥🔥🔥 VITE CONFIG DEBUG START 🔥🔥🔥');
console.log('Mode:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());
console.log('');

// Manuell alle .env Dateien lesen und deren VITE_API_URL ausgeben
const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
];

console.log('📄 Checking .env files in order of Vite loading:');
envFiles.forEach(file => {
  const path = join(process.cwd(), file);
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    const apiUrlLine = content.split('\n').find(l => l.trim().startsWith('VITE_API_URL='));
    console.log(`  ✅ ${file.padEnd(30)} → ${apiUrlLine || '(no VITE_API_URL)'}`);
  } else {
    console.log(`  ❌ ${file.padEnd(30)} → NOT FOUND`);
  }
});

console.log('');
console.log('🔍 Process Environment Variables:');
console.log('  VITE_API_URL:', process.env.VITE_API_URL);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  MODE:', process.env.MODE);
console.log('🔥🔥🔥 VITE CONFIG DEBUG END 🔥🔥🔥');
console.log('');

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    // Remove console.logs in production build (keeps console.error)
    removeConsole({
      includes: ['log', 'debug', 'info', 'warn'],
      excludes: ['error'], // Keep console.error for critical errors
    }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
