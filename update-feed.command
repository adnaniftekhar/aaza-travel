#!/bin/bash
# Double-click this whenever your Mac is on to pull new Instagram + blog posts
# onto the website. Takes about 10–20 seconds.

cd "$(dirname "$0")"

NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo ""
  echo "ERROR: Node.js is not installed."
  echo "Install it from https://nodejs.org then try again."
  echo ""
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo ""
echo "=========================================="
echo "  AAZA — Updating Instagram + Blog"
echo "=========================================="
echo ""
echo "Fetching new posts and pushing to the website..."
echo "(This is how Amy's collab posts get added.)"
echo ""

"$NODE_BIN" scripts/update-and-push.mjs
EXIT=$?

echo ""
if [ "$EXIT" -eq 0 ]; then
  echo "Done! Give the site a minute, then refresh:"
  echo "  https://aazaadventures.com"
  echo ""
  echo "Tip: hard-refresh with Cmd + Shift + R if you don't see new posts."
else
  echo "Something went wrong. Check logs/feed-update.log for details."
fi
echo ""
read -n 1 -s -r -p "Press any key to close..."
