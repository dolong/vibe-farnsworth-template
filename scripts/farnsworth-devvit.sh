#!/bin/bash
# farnsworth:devvit: boot the Devvit preview for Farnsworth's canvas.
#
# Starts BOTH halves of the local app:
#   1. the Vite harness (dev-tools/, port 5174) that the canvas iframes, and
#   2. Farnsworth's emulator-backed server-runner, which runs src/server
#      against Farnsworth's Redis + Reddit emulators (port 3000). Without it
#      the preview renders but comments, mock posts, post types, and every
#      /api call fail.
#
# Writes ~/.cache/farnsworth-devvit.json with
# {type, url, pid, serverPid, serverPort, serverUrl, startedAt, log, serverLog, repoRoot}.
#
# Usage:
#   npm run farnsworth:devvit   # boot (replaces any running instance)

set -e

APP_TYPE="devvit"
CACHE_DIR="$HOME/.cache"
META_FILE="$CACHE_DIR/farnsworth-${APP_TYPE}.json"
LOG_FILE="$CACHE_DIR/farnsworth-${APP_TYPE}.log"
PORT="${FARNSWORTH_PORT_VITE:-5174}"
SERVER_PORT="${FARNSWORTH_PORT_SERVER:-3000}"
URL="http://localhost:${PORT}"
SERVER_URL="http://127.0.0.1:${SERVER_PORT}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_LOG="$CACHE_DIR/farnsworth-${APP_TYPE}-server.log"
REPO_HASH="$(printf '%s' "$REPO_ROOT" | xxd -p | tr -d '\n' | cut -c1-16)"

mkdir -p "$CACHE_DIR"

# Apple Silicon Homebrew node/npm when launched from the IDE.
export PATH="/opt/homebrew/bin:${PATH}"

# 1. Stop any previous instance: pids from the meta file, then a scoped sweep.
if [ -f "$META_FILE" ]; then
  for KEY in pid serverPid; do
    OLD=$(node -e "try { process.stdout.write(String(JSON.parse(require('fs').readFileSync('$META_FILE','utf8')).$KEY || '')) } catch(e){}" 2>/dev/null || true)
    if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
      kill "$OLD" 2>/dev/null || true
    fi
  done
  sleep 0.5
fi
pkill -f 'vite.devtools.config.ts' 2>/dev/null || true
pkill -f "server-runner.mjs ${REPO_ROOT}" 2>/dev/null || true
sleep 0.3

cd "$REPO_ROOT"

# 2. Vite harness.
echo "starting ${APP_TYPE} vite dev server on $URL..."
WEBBIT_PORT="$SERVER_PORT" nohup npm run dev:tools > "$LOG_FILE" 2>&1 </dev/null &
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
  sleep 0.5
done

echo "✗ farnsworth:${APP_TYPE} dev server failed to respond within 30s; tail $LOG_FILE" >&2
exit 1
