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
echo "If Instagram blocks the fetch, this will now SHOW AN ERROR"
echo "instead of pretending it worked."
echo ""
echo "Backup plan for a missing color post:"
echo "  double-click  add-instagram-post.command"
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
  echo "UPDATE FAILED — Instagram likely blocked the automatic fetch."
  echo ""
  echo "To add the BROWN (or any) post right now:"
  echo "  1. Double-click  add-instagram-post.command"
  echo "  2. Paste the Instagram link"
  echo "  3. Paste the full caption (must start with BROWN: )"
  echo "  4. Optionally choose the photo from Downloads"
  echo ""
  echo "Details: logs/feed-update.log"
fi
echo ""
read -n 1 -s -r -p "Press any key to close..."
exit "$EXIT"
