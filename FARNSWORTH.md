# Farnsworth IDE Integration

This template ships with a small **local preview harness** that lets you render
the Devvit client (`splash.tsx`, `game.tsx`) in an ordinary browser or inside
the [Farnsworth](https://github.com/dolong) IDE canvas — without a Reddit login
or a live Devvit playtest session.

In Farnsworth, this powers the **Live Preview** canvas: a real render of your
app inside the Reddit post, mobile, and desktop frames, updating as you edit.

---

## TL;DR

```bash
# 1. Install deps (Node 22+)
npm install

# 2a. Preview in a plain browser:
npm run dev:tools           # → http://localhost:5174

# 2b. …or let Farnsworth boot + manage it:
#     open the folder in Farnsworth, switch the canvas to "Live Preview",
#     and click "Go Live". (Equivalent to running `npm run farnsworth:devvit`.)
```

---

## Why this exists

The real Devvit runtime (`npm run dev` → `devvit playtest`) runs your client
inside an iframe **on reddit.com**, wired to Reddit's servers. That's great for
final testing, but it's slow to iterate on pure UI and it can't be embedded in
a local IDE.

The harness solves that by rendering the same React components locally with a
**stubbed Devvit client**, so you get instant HMR and an embeddable URL.

| | `npm run dev` (Devvit) | `npm run dev:tools` (harness) |
|---|---|---|
| Runtime | reddit.com iframe | local Vite server |
| Reddit login | required | not required |
| `@devvit/web/client` | real | stubbed (`dev-tools/devvit-shim.ts`) |
| tRPC / `game.tsx` data | live Reddit backend | proxied to local Devvit server if running |
| Speed | slower | instant HMR |
| Embeddable in IDE | no | yes (`http://localhost:5174`) |

---

## Installation

Requirements: **Node 22+** and the normal template setup (see `README.md`).

```bash
npm install
```

No extra dependencies are needed — the harness reuses the template's existing
Vite / React / Tailwind toolchain via a separate Vite config.

### Using it with Farnsworth

1. Open this folder as a workspace in Farnsworth.
2. Farnsworth reads `.farnsworth/config.json` (`{"appType": "devvit"}`) to know
   this is a Devvit app.
3. In the canvas overlay bar, switch to **Live Preview** and click **Go Live**.
   Farnsworth runs `npm run farnsworth:devvit` for you, waits for the server,
   and swaps the static preview images for live iframes.
4. Use the **Post View / App Mobile / App Desktop** toggles to see each frame.
5. Click the green **Live** pill to stop the server.

You can also boot it manually from a terminal (`npm run farnsworth:devvit`);
Farnsworth will auto-detect it either way.

---

## How it works

### 1. A separate Vite config: `vite.devtools.config.ts`

This config is what makes local rendering possible. Key pieces:

- **`root: dev-tools/`** — serves the harness HTML/JS instead of the Devvit
  entrypoints.
- **`@devvit/web/client` → `dev-tools/devvit-shim.ts`** alias — replaces the
  real Devvit client (which only works on reddit.com) with a stub, so
  `splash.tsx` / `game.tsx` import unmodified.
- **`@src` → `src/`** alias — lets the harness import your real components.
- **`server.port: 5174`** — the fixed URL Farnsworth expects.
- **`/api/trpc` proxy → `http://localhost:${WEBBIT_PORT ?? 3000}`** — forwards
  tRPC calls to a running Devvit server, so `game.tsx` can load real data if
  `npm run dev` is also running. `splash.tsx` is tRPC-free and works alone.

### 2. The Devvit shim: `dev-tools/devvit-shim.ts`

Stubs the `@devvit/web/client` API surface your components use:

- `context` → fake `{ username, postId, subredditName }`
- `requestExpandedMode`, `navigateTo`, `showToast`, `showForm` → console logs
- `useDevvitContext()` → returns the fake context

This only applies under `dev:tools`. **Production builds use the real
`@devvit/web/client`** — the shim never ships.

### 3. The render shell: `dev-tools/Shell.jsx`

Reads a `?view=` query param and renders the right component, chromeless, sized
to fill the iframe:

| URL | Renders | Used by Farnsworth for |
|---|---|---|
| `/?view=post` | `<Splash />` | Reddit post (inline) frame |
| `/?view=mobile` | `<App />` | App Mobile frame |
| `/?view=desktop` | `<App />` | App Desktop frame |
| `/` (no param) | tab picker | manual browsing (Splash / Game tabs) |

Each view is wrapped in a `.post-stage` / `.mobile-stage` / `.desktop-stage`
div that fills the iframe.

### 4. Fit CSS: `dev-tools/index.html` + `dev-tools/style.css`

Devvit components use Tailwind's `min-h-screen` (100vh). Inside an IDE iframe
that would force scrollbars, so the harness CSS neutralizes it: `html`, `body`,
`#root`, and the stage wrappers are `height: 100%; overflow: hidden`, and
`.min-h-screen` is overridden to `min-height: 0`. The components then center
against the real iframe height instead of the viewport.

### 5. The boot script: `scripts/farnsworth-devvit.sh`

Invoked by `npm run farnsworth:devvit`. It:

1. Kills any previous instance (by pid from the meta file, plus a
   `pkill -f vite.devtools.config.ts` sweep).
2. Ensures `/opt/homebrew/bin` is on `PATH` (Apple Silicon).
3. Boots `npm run dev:tools` in the background (`nohup … & disown`).
4. Writes **`~/.cache/farnsworth-devvit.json`**:
   ```json
   {
     "type": "devvit",
     "url": "http://localhost:5174",
     "pid": 12345,
     "startedAt": "2026-07-02T20:17:53.317Z",
     "log": "~/.cache/farnsworth-devvit.log",
     "repoRoot": "…/vibe-farnsworth-template"
   }
   ```
5. Polls the URL until it returns `200` (max 30s), then exits `0`.

Farnsworth reads that meta file to find the server URL and pid.

---

## File map

```
vite.devtools.config.ts        # separate Vite config (root=dev-tools, shim alias, :5174, tRPC proxy)
scripts/farnsworth-devvit.sh   # boot script → writes ~/.cache/farnsworth-devvit.json
.farnsworth/config.json        # {"appType": "devvit"} — tells Farnsworth what this workspace is
dev-tools/
  index.html                   # harness entry HTML + fit CSS
  main.jsx                     # mounts <Shell/> into #root
  Shell.jsx                    # ?view= dispatcher (post / mobile / desktop / standalone)
  devvit-shim.ts               # stub for @devvit/web/client (dev-only)
  style.css                    # iframe-fit overrides (no scrollbars)
```

---

## Troubleshooting

- **Port 5174 in use / stale server** — stop it with
  `pkill -f vite.devtools.config.ts`, then re-run.
- **`game.tsx` shows no data** — `game.tsx` needs tRPC. Run `npm run dev` (the
  real Devvit server) alongside so the `/api/trpc` proxy has a backend; or set
  `WEBBIT_PORT` if your Devvit server isn't on 3000. `splash.tsx` needs nothing.
- **`npm: command not found` in the boot script** — the script prepends
  `/opt/homebrew/bin` to `PATH`; if node/npm live elsewhere, adjust the export
  in `scripts/farnsworth-devvit.sh`.
- **Scrollbars in the preview** — the fit CSS lives in `dev-tools/index.html`
  (inline) and `dev-tools/style.css`; make sure both are intact and that
  `dev-tools/index.html` links `style.css`.
- **Farnsworth doesn't detect the server** — confirm
  `~/.cache/farnsworth-devvit.json` exists and its `url` responds with `200`.

---

## Notes

- This harness is **additive**: it does not touch the Devvit entrypoints,
  `devvit.json`, or the production build. `npm run dev`, `build`, `deploy`, and
  `launch` behave exactly as in the upstream template.
- It's a fork of
  [reddit/devvit-template-vibe-coding](https://github.com/reddit/devvit-template-vibe-coding);
  pull upstream template updates via the `upstream` remote.
