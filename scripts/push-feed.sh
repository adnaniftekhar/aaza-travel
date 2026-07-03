#!/bin/bash
# Fetch Instagram posts and push to GitHub if anything changed.
# Designed to run on your Mac (home IP) where Instagram allows profile reads.

set -e
cd "$(dirname "$0")/.."
mkdir -p logs

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

{
  echo "=== $(date) ==="
  node scripts/fetch-instagram.mjs

  git add js/feed.json photos/feed/
  if git diff --staged --quiet; then
    echo "No feed changes."
    exit 0
  fi

  git commit -m "Update Instagram feed"
  git pull --rebase origin main
  git push
  echo "Pushed feed update."
} >> logs/feed-update.log 2>&1
