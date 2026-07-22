import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'dev-tools'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      // Stub the Devvit client so splash.tsx / game.tsx can render unmodified
      // outside the Devvit playtest environment.
      '@devvit/web/client': path.resolve(__dirname, 'dev-tools/devvit-shim.ts'),
      // Let stories import from the main src tree
      '@src': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    // Farnsworth boots this server for its in-app canvas iframe — don't pop a
    // separate browser tab on Go Live.
    open: false,
    proxy: {
      // Forward tRPC calls to the Devvit server (WEBBIT_PORT, default 3000).
      // Game.tsx uses trpc.init.get.query() so without this, dev-tools can't
      // load the real game. Splash.tsx is tRPC-free.
      '/api/trpc': {
        target: `http://localhost:${process.env.WEBBIT_PORT ?? 3000}`,
        changeOrigin: true,
      },
    },
  },
});