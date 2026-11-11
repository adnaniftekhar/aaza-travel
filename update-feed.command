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
echo "(Amy's collab posts sync via a cookie-free Chrome scrape on this Mac.)"
echo ""

# First run (or after a pull) needs Playwright Chromium once.
if [ -f package.json ]; then
  "$NODE_BIN" -e "require('playwright')" 2>/dev/null || "$NODE_BIN" npm --prefix . install
  npx --yes playwright install chromium >/dev/null 2>&1 || true
fi

"$NODE_BIN" scripts/update-and-push.mjs
EXIT=$?

echo ""
if [ "$EXIT" -eq 0 ]; then
  if [ -f logs/scrape-status.json ] && grep -q '"scrapeFailed": true' logs/scrape-status.json; then
    echo "Finished, but Instagram did not return Amy's collab grid this time."
    echo "Adnan's posts may still have updated. Try again later from this Mac."
    echo ""
  else
    echo "Done! Give the site a minute, then refresh:"
    echo "  https://aazaadventures.com"
    echo ""
    echo "Tip: hard-refresh with Cmd + Shift + R if you don't see new posts."
  fi
else
  echo "UPDATE FAILED — see logs/feed-update.log"
fi
echo ""
read -n 1 -s -r -p "Press any key to close..."
exit "$EXIT"
