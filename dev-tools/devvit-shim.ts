/**
 * Devvit client shim — used only by `npm run dev:tools` so that
 * src/client/splash.tsx and src/client/game.tsx can render unmodified
 * outside the Devvit playtest environment.
 *
 * Vite aliases `@devvit/web/client` → this file when the devtools config
 * is active. In production builds the real `@devvit/web/client` is used.
 */

export const context = {
  username: 'dev-user',
  postId: 'dev-post',
  subredditName: 'dev-subreddit',
};

export const requestExpandedMode = () => {
  console.log('[devvit-shim] requestExpandedMode()');
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

export const useDevvitContext = () => context;