#!/bin/bash
# Double-click this to STOP the automatic every-2-hours updater
# (use this if you only want to update manually with update-feed.command)

PLIST="$HOME/Library/LaunchAgents/com.aaza.feed-update.plist"

launchctl bootout "gui/$(id -u)/com.aaza.feed-update" 2>/dev/null || true

echo ""
echo "Automatic background updater stopped."
echo ""
echo "To update the site manually, double-click:"
echo "  update-feed.command"
echo ""
read -n 1 -s -r -p "Press any key to close..."
