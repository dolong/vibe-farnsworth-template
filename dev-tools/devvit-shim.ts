/**
 * Devvit client shim: used only by `npm run dev:tools` so the real client
 * entries (src/client/splash.tsx, game.tsx) run outside the Devvit playtest.
 *
 * Vite aliases `@devvit/web/client` to this file when the devtools config
 * is active. In production builds the real `@devvit/web/client` is used.
 *
 * Farnsworth's Post View passes the selected mock post in the URL:
 *   ?view=post&postId=t3_x&entry=default|game&mode=inline|expanded&postData=<base64url JSON>
 */

const params = new URLSearchParams(window.location.search);

const decodePostData = (raw: string | null): unknown => {
  if (!raw) return undefined;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
};

const emulatorConfig = (() => {
  try {
    return JSON.parse(import.meta.env.VITE_DEVVIT_EMULATOR_CONFIG_JSON || '{}');
  } catch {
    return {};
  }
})();

const postId = params.get('postId') || 'dev-post';

export const context = {
  username: emulatorConfig.currentUsername || 'dev-user',
  postId,
  postData: decodePostData(params.get('postData')),
  subredditName: emulatorConfig.currentSubredditName || 'dev-subreddit',
  entry: params.get('entry') || 'default',
};

// Tell the emulator-backed server which post this request is from, so
// context.postId / context.postData match on the server too.
if (params.get('postId')) {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
    if (!sameOrigin) return origFetch(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('x-farnsworth-post-id', postId);
    return origFetch(input, { ...init, headers });
  };
}

export type WebViewMode = 'inline' | 'expanded';
export type WebViewModeListener = (mode: WebViewMode) => void;
export type WebViewOptions = { title?: string };

const postToIde = (message: Record<string, unknown>) => {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  } else {
    console.log('[devvit-shim]', message);
  }
};

/**
 * On Reddit this opens the post's expanded web view at `entry`, with an
 * optional header title (Devvit 0.15). It also works while already expanded.
 * Inside Farnsworth the IDE swaps the Post View embed to that entry and shows
 * the title in its expanded header.
 */
export const requestExpandedMode = (_event?: Event, entry = 'game', options?: WebViewOptions) => {
  postToIde({ type: 'devvit:requestExpandedMode', entry, title: options?.title });
};

/**
 * On Reddit this returns the web view to inline. Like Reddit, it throws when
 * already inline.
 */
export const exitExpandedMode = (_event?: Event) => {
  if (getWebViewMode() === 'inline') throw Error('web view is already inlined');
  postToIde({ type: 'devvit:exitExpandedMode' });
};

// Deprecated on Reddit. Farnsworth reloads the embed on every mode change, so
// (as Reddit documents for destroyed web views) listeners never fire here.
const modeListeners = new Set<WebViewModeListener>();
export const addWebViewModeListener = (callback: WebViewModeListener) => {
  modeListeners.add(callback);
};
export const removeWebViewModeListener = (callback: WebViewModeListener) => {
  modeListeners.delete(callback);
};

export const navigateTo = (url: string) => {
  console.log('[devvit-shim] navigateTo:', url);
};

export const showToast = (message: string) => {
  console.log('[devvit-shim] showToast:', message);
};

export const showForm = (form: unknown) => {
  console.log('[devvit-shim] showForm:', form);
};

export const getWebViewMode = (): WebViewMode => {
  const mode = params.get('mode');
  if (mode === 'inline' || mode === 'expanded') return mode;
  return params.get('view') === 'post' ? 'inline' : 'expanded';
};

export const useDevvitContext = () => context;
