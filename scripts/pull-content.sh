#!/bin/bash
# Force the server to commit+push any pending content edits, then pull locally.
# Run from the hpp-study-buddy repo root: bash scripts/pull-content.sh

set -e

VPS="root@168.119.231.157"
LOCAL_CONTENT="$(cd "$(dirname "$0")/.." && pwd)/content"

echo "==> Forcing sync on server..."
ssh "$VPS" "/opt/hpp-study-buddy/scripts/sync-content.sh"

echo "==> Pulling content locally..."
if [ ! -d "$LOCAL_CONTENT/.git" ]; then
  echo "No local content repo at $LOCAL_CONTENT — cloning..."
  git clone git@github.com:maxmagu/hpp-study-buddy-content.git "$LOCAL_CONTENT"
else
  git -C "$LOCAL_CONTENT" pull --ff-only origin main
fi

echo ""
echo "==> Done."
