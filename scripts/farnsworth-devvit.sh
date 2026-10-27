#!/bin/bash
# farnsworth:devvit: boot the Devvit preview for Farnsworth's canvas.
#
# Starts BOTH halves of the local app:
#   1. the Vite harness (dev-tools/) that the canvas iframes, and
#   2. Farnsworth's emulator-backed server-runner, which runs src/server
#      against Farnsworth's Redis + Reddit emulators. Without it the preview
#      renders but comments, mock posts, post types, and every /api call fail.
#
# Multi-live (Oct 27 2026): Farnsworth picks free ports from its shared
# registry and passes them in, so several projects can be live at once:
#   FARNSWORTH_PORT_VITE / FARNSWORTH_PORT_SERVER  ports to bind (strict)
#   FARNSWORTH_DEVVIT_META                         per-project metadata file
#   FARNSWORTH_DEVVIT_LOG / _SERVER_LOG            per-project logs
# Run by hand with none of those set, it behaves like before (5174 / 3000).
#
# Usage:
#   npm run farnsworth:devvit   # boot (replaces this project's running copy)

set -e

APP_TYPE="devvit"
CACHE_DIR="$HOME/.cache"
META_FILE="${FARNSWORTH_DEVVIT_META:-$CACHE_DIR/farnsworth-${APP_TYPE}.json}"
LOG_FILE="${FARNSWORTH_DEVVIT_LOG:-$CACHE_DIR/farnsworth-${APP_TYPE}.log}"
SERVER_LOG="${FARNSWORTH_DEVVIT_SERVER_LOG:-$CACHE_DIR/farnsworth-${APP_TYPE}-server.log}"
PORT="${FARNSWORTH_PORT_VITE:-5174}"
SERVER_PORT="${FARNSWORTH_PORT_SERVER:-3000}"
URL="http://localhost:${PORT}"
SERVER_URL="http://127.0.0.1:${SERVER_PORT}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_HASH="$(printf '%s' "$REPO_ROOT" | shasum -a 256 | cut -c1-16)"  # full-path hash, matches Farnsworth devvitRepoKey()

mkdir -p "$CACHE_DIR"

# Apple Silicon Homebrew node/npm when launched from the IDE.
export PATH="/opt/homebrew/bin:${PATH}"

kill_tree() {
  local p="$1" c
  [ -n "$p" ] || return 0
  for c in $(pgrep -P "$p" 2>/dev/null); do kill_tree "$c"; done
  kill "$p" 2>/dev/null || true
}

# 1. Stop THIS project's previous copy only (other projects may be live in
#    other Farnsworth windows): pids from the meta file, then a sweep scoped
#    to this repo's own paths.
if [ -f "$META_FILE" ]; then
  for KEY in pid serverPid; do
    OLD=$(node -e "try { const m = JSON.parse(require('fs').readFileSync('$META_FILE','utf8')); if (!m.repoRoot || m.repoRoot === '$REPO_ROOT') process.stdout.write(String(m.$KEY || '')) } catch(e){}" 2>/dev/null || true)
    if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then kill_tree "$OLD"; fi
  done
  sleep 0.5
fi
pkill -f "${REPO_ROOT}/node_modules/.bin/vite --config vite.devtools.config.ts" 2>/dev/null || true
pkill -f "server-runner.mjs ${REPO_ROOT}\$" 2>/dev/null || true
sleep 0.3

cd "$REPO_ROOT"

# 2. Vite harness, on exactly the assigned port (the config's 5174 is only
#    the hand-run default; --strictPort fails loudly instead of sliding onto
#    a port Farnsworth doesn't know about).
echo "starting ${APP_TYPE} vite dev server on $URL..."
WEBBIT_PORT="$SERVER_PORT" nohup npm run dev:tools -- --port "$PORT" --strictPort > "$LOG_FILE" 2>&1 </dev/null &
VITE_PID=$!
disown

# 3. Devvit server via Farnsworth's server-runner. Farnsworth passes the
#    installed runner path in FARNSWORTH_DEVVIT_RUNNER; the dev-tree path is
#    only a fallback for running this script by hand on Long's mini.
RUNNER="${FARNSWORTH_DEVVIT_RUNNER:-$HOME/Documents/Farnsworth/app/devvit-emulator/server-runner.mjs}"
SERVER_PID=""
if [ -f "$RUNNER" ]; then
  echo "starting devvit server-runner on $SERVER_URL..."
  DEVVIT_EMULATOR_SERVER_PORT="$SERVER_PORT" \
    DEVVIT_EMULATOR_STATE="${DEVVIT_EMULATOR_STATE:-$CACHE_DIR/farnsworth-devvit-${REPO_HASH}-state.json}" \
    nohup node "$RUNNER" "$REPO_ROOT" > "$SERVER_LOG" 2>&1 </dev/null &
  SERVER_PID=$!
  disown
else
  echo "warning: server-runner not found at $RUNNER; preview will run without the Devvit server" >&2
fi

# 4. Metadata for Farnsworth.
node -e "
const fs = require('fs');
const serverPid = '$SERVER_PID' ? Number('$SERVER_PID') : null;
const meta = {
  type: '$APP_TYPE',
  url: '$URL',
  pid: $VITE_PID,
  serverPid,
  serverPort: serverPid ? $SERVER_PORT : null,
  serverUrl: serverPid ? '$SERVER_URL' : null,
  startedAt: new Date().toISOString(),
  log: '$LOG_FILE',
  serverLog: serverPid ? '$SERVER_LOG' : null,
  repoRoot: '$REPO_ROOT',
};
fs.writeFileSync('$META_FILE', JSON.stringify(meta, null, 2));
"

# 5. Wait for the harness (max 30s).
echo "waiting for $URL to respond..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w '%{http_code}' "$URL/" 2>/dev/null | grep -q '^200$'; then
    echo "✓ farnsworth:${APP_TYPE} preview up at $URL (pid $VITE_PID)"
    [ -n "$SERVER_PID" ] && echo "  server: $SERVER_URL (pid $SERVER_PID, log $SERVER_LOG)"
    exit 0
  fi
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "✗ vite exited before binding port $PORT; log follows" >&2
    tail -30 "$LOG_FILE" >&2 2>/dev/null || true
    [ -n "$SERVER_PID" ] && kill_tree "$SERVER_PID"
    exit 1
  fi
  sleep 0.5
done

echo "✗ farnsworth:${APP_TYPE} dev server failed to respond within 30s; tail $LOG_FILE" >&2
kill_tree "$VITE_PID"; [ -n "$SERVER_PID" ] && kill_tree "$SERVER_PID"
exit 1
