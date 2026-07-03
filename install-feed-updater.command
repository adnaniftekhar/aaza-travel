#!/bin/bash
# Double-click this once to auto-update the Instagram feed every 2 hours from your Mac.

REPO="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.aaza.feed-update.plist"
SCRIPT="$REPO/scripts/push-feed.sh"

chmod +x "$SCRIPT"
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
    <string>/bin/bash</string>
    <string>$SCRIPT</string>
  </array>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$REPO/logs/feed-update.log</string>
  <key>StandardErrorPath</key>
  <string>$REPO/logs/feed-update.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.aaza.feed-update" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST"

echo ""
echo "Done! The Instagram feed will auto-update every 2 hours while your Mac is on."
echo "Log file: $REPO/logs/feed-update.log"
echo ""
read -n 1 -s -r -p "Press any key to close..."
