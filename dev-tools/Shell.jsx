import { useState, useMemo } from 'react';
import { Splash } from '@src/client/splash';
import { App } from '@src/client/game';

const TABS = [
  { id: 'splash', label: 'Splash (Inline)', render: () => <Splash /> },
  { id: 'game', label: 'Game (Expanded)', render: () => <App /> },
];

// Read ?view= from the URL so the Farnsworth canvas can link to specific
// modes (post / mobile / desktop) without showing the dev-tools tab UI.
// Defaults to 'standalone' which renders the tab picker for manual use.
function readView() {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view');
  if (v === 'post' || v === 'mobile' || v === 'desktop') return v;
  return 'standalone';
}

export const Shell = () => {
  const view = useMemo(() => readView(), []);
  const [active, setActive] = useState('splash');

  // Farnsworth canvas iframe mode — render the requested component alone,
  // sized to fill the iframe. No tab UI, no shell chrome. The Farnsworth
  // canvas provides the surrounding Reddit / phone / desktop chrome.
  if (view === 'post') {
    return (
      <div className="post-stage">
        <Splash />
      </div>
    );
  }
  if (view === 'mobile') {
    return (
      <div className="mobile-stage">
        <App />
      </div>
    );
  }
  if (view === 'desktop') {
    return (
      <div className="desktop-stage">
        <App />
      </div>
    );
  }

  // Standalone mode — tab picker for manual iteration in a browser tab.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          background: '#1a1a1a',
          borderBottom: '1px solid #333',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            style={{
              padding: '6px 14px',
              background: active === tab.id ? '#d93900' : '#2a2a2a',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            {tab.label}
          </button>
        ))}
        <span
          style={{
            marginLeft: 'auto',
            alignSelf: 'center',
            color: '#666',
            fontSize: 11,
          }}
        >
          Dev Tools · vite · port 5174
        </span>
      </nav>
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        {TABS.find((t) => t.id === active)?.render()}
      </div>
    </div>
  );
};