#!/bin/bash
# Double-click once to auto-update Instagram + blog every 2 hours from your Mac.

REPO="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.aaza.feed-update.plist"
NODE_SCRIPT="$REPO/scripts/update-and-push.mjs"

# launchd does NOT have Homebrew in PATH — must use the full path to node.
NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: node not found. Install Node.js first (https://nodejs.org)"
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

mkdir -p "$REPO/logs"

cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.aaza.feed-update</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$NODE_SCRIPT</string>
  </array>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
  <key>StandardOutPath</key>
  <string>$REPO/logs/feed-update.log</string>
  <key>StandardErrorPath</key>
  <string>$REPO/logs/feed-update.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.aaza.feed-update" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo ""
echo "Done! Instagram + blog will auto-update every 2 hours while your Mac is on."
echo "Using node: $NODE_BIN"
echo "Log file: $REPO/logs/feed-update.log"
echo ""
"$NODE_BIN" "$NODE_SCRIPT"
echo ""
read -n 1 -s -r -p "Press any key to close..."
