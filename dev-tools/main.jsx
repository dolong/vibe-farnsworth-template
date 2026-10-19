import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import entries from 'virtual:devvit-entries';
import { Shell } from './Shell.jsx';

// Each devvit.json entrypoint is its own page on Reddit: its html loads one
// module script that mounts itself into #root. The harness does the same:
//   ?view=post&entry=<name>        -> that entry, inline (Farnsworth Post View)
//   ?view=mobile|desktop|game      -> the expanded entry ('game' or first non-inline)
//   no view                        -> Shell: a picker that previews each entry
const params = new URLSearchParams(window.location.search);
const view = params.get('view') || '';
const root = document.getElementById('root');

function pickExpanded() {
  if (entries.game) return 'game';
  return Object.keys(entries).find((n) => !entries[n].inline) || 'default';
}

function mount(name, stageClass) {
  const e = entries[name] || entries.default;
  if (!e) {
    root.textContent = `No devvit.json entrypoint named "${name}" (and no default).`;
    return;
  }
  for (const href of e.links) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  root.className = [stageClass, e.rootClass].filter(Boolean).join(' ');
  e.load();
}

if (view === 'post') {
  mount(params.get('entry') || 'default', 'post-stage');
} else if (view === 'mobile' || view === 'game') {
  mount(params.get('entry') || pickExpanded(), 'mobile-stage');
} else if (view === 'desktop') {
  mount(params.get('entry') || pickExpanded(), 'desktop-stage');
} else {
  createRoot(root).render(
    <StrictMode>
      <Shell entries={entries} />
    </StrictMode>,
  );
}
