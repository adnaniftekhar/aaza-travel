#!/bin/bash
# Manually add one Instagram post (for when automatic fetch is blocked).
# Double-click this, paste the Instagram link + caption, optionally pick the photo.

cd "$(dirname "$0")"

NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Node.js is not installed."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo ""
echo "=========================================="
echo "  AAZA — Add one Instagram post"
echo "=========================================="
echo ""
echo "Use this when update-feed cannot reach Instagram."
echo "You will paste:"
echo "  1) the Instagram post link"
echo "  2) the full caption (e.g. BROWN: ...)"
echo "  3) optionally choose the photo from your Downloads"
echo ""

"$NODE_BIN" scripts/add-instagram-post.mjs
ADD_EXIT=$?
if [ "$ADD_EXIT" -ne 0 ]; then
  echo ""
  echo "Canceled or failed."
  read -n 1 -s -r -p "Press any key to close..."
  exit "$ADD_EXIT"
fi

echo ""
echo "Pushing to the website..."
git add js/feed.json js/feed-archive.json photos/feed/
if git diff --staged --quiet; then
  echo "Nothing new to push."
else
  git commit -m "Add Instagram post manually"
  git pull --rebase origin main
  git push origin main
  echo "Pushed! Give the site a minute, then hard-refresh Colors."
fi

echo ""
echo "  https://aazaadventures.com/colors.html"
echo ""
read -n 1 -s -r -p "Press any key to close..."
