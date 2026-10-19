import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reads devvit.json post.entrypoints and exposes them to the harness as
// `virtual:devvit-entries`: { [name]: { load, links, rootClass, inline, height } }.
// Each entry's html file under src/client names its module script, so Post
// View loads exactly the script Reddit would for that entry. Adding an
// entrypoint to devvit.json is all it takes; no harness edit.
// Tailwind v4 finds class names by scanning from Vite's root, which here is
// dev-tools/, so the app's own src/ classes were never generated and every
// preview rendered unstyled. Point any stylesheet that imports Tailwind at src/.
function tailwindScanSrc(): Plugin {
  const srcDir = path.resolve(__dirname, 'src').split(path.sep).join('/');
  return {
    name: 'tailwind-scan-src',
    enforce: 'pre',
    transform(code, id) {
      if (!/\.css(\?|$)/.test(id) || !/@import\s+["']tailwindcss/.test(code)) return null;
      if (code.includes(`@source "${srcDir}"`)) return null;
      return { code: `${code}\n@source "${srcDir}";\n`, map: null };
    },
  };
}

function devvitEntries(): Plugin {
  const VIRTUAL = 'virtual:devvit-entries';
  const RESOLVED = '\0' + VIRTUAL;
  const devvitJsonPath = path.resolve(__dirname, 'devvit.json');
  const build = () => {
    let cfg: any = {};
    try { cfg = JSON.parse(fs.readFileSync(devvitJsonPath, 'utf8')); } catch { /* no devvit.json */ }
    const clientDir = path.resolve(__dirname, cfg?.post?.dir === 'dist/client' || !cfg?.post?.dir ? 'src/client' : cfg.post.dir);
    const out: string[] = [];
    for (const [name, ep] of Object.entries<any>(cfg?.post?.entrypoints || {})) {
      const htmlPath = path.resolve(clientDir, String(ep?.entry || ''));
      let html = '';
      try { html = fs.readFileSync(htmlPath, 'utf8'); } catch { continue; }
      const script = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i.exec(html)
        || /<script[^>]*src=["']([^"']+)["'][^>]*type=["']module["']/i.exec(html);
      if (!script) continue;
      const scriptPath = path.resolve(path.dirname(htmlPath), script[1]);
      const links = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)]
        .map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1])
        .filter((h): h is string => !!h && /^https?:/i.test(h));
      const rootClass = /<div[^>]*id=["']root["'][^>]*class=["']([^"']*)["']/i.exec(html)?.[1] || '';
      out.push(`  ${JSON.stringify(name)}: { load: () => import(${JSON.stringify(scriptPath)}), links: ${JSON.stringify(links)}, rootClass: ${JSON.stringify(rootClass)}, inline: ${!!ep?.inline}, height: ${JSON.stringify(ep?.height || 'regular')} },`);
    }
    return `export default {\n${out.join('\n')}\n};\n`;
  };
  return {
    name: 'devvit-entries',
    resolveId: (id) => (id === VIRTUAL ? RESOLVED : null),
    load: (id) => (id === RESOLVED ? build() : null),
    configureServer(server) {
      server.watcher.add(devvitJsonPath);
      server.watcher.on('change', (file) => {
        if (path.resolve(file) !== devvitJsonPath) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'dev-tools'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [tailwindScanSrc(), react(), tailwind(), devvitEntries()],
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
      // Forward ALL /api calls (tRPC and plain Hono routes) to the Devvit
      // server-runner that scripts/farnsworth-devvit.sh starts
      // (WEBBIT_PORT, default 3000).
      '/api': {
        target: `http://localhost:${process.env.WEBBIT_PORT ?? 3000}`,
        changeOrigin: true,
      },
    },
  },
});