import { useState } from 'react';

// Standalone harness (open http://localhost:5174 in a browser): one tab per
// devvit.json entrypoint, each previewed in an iframe exactly like
// Farnsworth's Post View loads it. Tabs come from devvit.json automatically.
export const Shell = ({ entries }) => {
  const names = Object.keys(entries);
  const [active, setActive] = useState(names[0] || 'default');
  const e = entries[active];
  const src = `?view=${e && !e.inline ? 'desktop' : 'post'}&entry=${encodeURIComponent(active)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'monospace' }}>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          background: '#1a1a1a',
          borderBottom: '1px solid #333',
        }}
      >
        {names.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setActive(name)}
            style={{
              padding: '6px 14px',
              background: active === name ? '#d93900' : '#2a2a2a',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            {name}
            {entries[name].inline ? ' (inline)' : ' (expanded)'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', alignSelf: 'center', color: '#666', fontSize: 11 }}>
          Dev Tools · entries from devvit.json
        </span>
      </nav>
      <iframe key={src} title={active} src={src} style={{ flex: 1, border: 0, background: '#fff' }} />
    </div>
  );
};
