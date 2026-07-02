#!/bin/bash
# farnsworth:devvit — boot the Devvit vibe-coding-template dev server in the
# background so Farnsworth IDE can render the live canvas via iframe.
#
# This is the Devvit-specific launcher. Other app types (three.js, blockchain,
# ...) get their own `farnsworth:<type>` scripts that write their own meta file
# (~/.cache/farnsworth-<type>.json). Farnsworth reads the meta matching the
# open workspace's appType.
#
# Writes ~/.cache/farnsworth-devvit.json with {type, url, pid, startedAt, log}.
#
# Usage:
#   npm run farnsworth:devvit          # boot (replaces any running instance)
#   pkill -f vite.devtools.config.ts   # stop
#
# Requires:
#   npm + node on PATH (export PATH="/opt/homebrew/bin:$PATH" if needed)

set -e

APP_TYPE="devvit"
CACHE_DIR="$HOME/.cache"
META_FILE="$CACHE_DIR/farnsworth-${APP_TYPE}.json"
LOG_FILE="$CACHE_DIR/farnsworth-${APP_TYPE}.log"
PORT=5174
URL="http://localhost:${PORT}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$CACHE_DIR"

# 1. Kill any old instance (best-effort)
if [ -f "$META_FILE" ]; then
  OLD_PID=$(node -e "try { console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf8')).pid || '') } catch(e){}" 2>/dev/null || true)
  if [ -n "$OLD_PID" ]; then
    if kill -0 "$OLD_PID" 2>/dev/null; then
      echo "killing old ${APP_TYPE} dev server (pid $OLD_PID)"
      kill "$OLD_PID" 2>/dev/null || true
      sleep 0.5
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
fi
pkill -f 'vite.devtools.config.ts' 2>/dev/null || true
sleep 0.3

# 2. Ensure npm is on PATH (Apple Silicon host_bash shells don't have it)
export PATH="/opt/homebrew/bin:${PATH}"

# 3. Boot vite in the background
cd "$REPO_ROOT"
echo "starting ${APP_TYPE} vite dev server on $URL..."
nohup npm run dev:tools > "$LOG_FILE" 2>&1 </dev/null &
VITE_PID=$!
disown

# 4. Write metadata so the Farnsworth main process can find us
node -e "
const fs = require('fs');
const meta = {
  type: '$APP_TYPE',
  url: '$URL',
  pid: $VITE_PID,
  startedAt: new Date().toISOString(),
  log: '$LOG_FILE',
  repoRoot: '$REPO_ROOT',
};
fs.writeFileSync('$META_FILE', JSON.stringify(meta, null, 2));
console.log('wrote $META_FILE');
"

# 5. Wait for the server to be ready (max 30s)
echo "waiting for $URL to respond..."
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w '%{http_code}' "$URL/" 2>/dev/null | grep -q '^200$'; then
    echo ""
    echo "✓ farnsworth:${APP_TYPE} dev server up at $URL"
    echo "  pid:    $VITE_PID"
    echo "  log:    $LOG_FILE"
    echo "  meta:   $META_FILE"
    echo ""
    echo "next:"
    echo "  - Farnsworth canvas auto-detects this when the open workspace is a ${APP_TYPE} app."
    echo "  - To stop: pkill -f vite.devtools.config.ts"
    exit 0
  fi
  sleep 0.5
done

echo ""
echo "✗ farnsworth:${APP_TYPE} dev server failed to respond within 30s"
echo "  tail $LOG_FILE for details"
exit 1