#!/bin/bash
# Commit and push pending content changes from the server to the content repo.
# Intended to run on the VPS, e.g. from cron:
#   */15 * * * * /opt/hpp-study-buddy/scripts/sync-content.sh >> /var/log/hpp-sync.log 2>&1

set -e

CONTENT_DIR="${CONTENT_DIR:-/opt/hpp-study-buddy/content}"

cd "$CONTENT_DIR"

# Nothing to do if the tree is clean.
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

git add -A
git -c user.name="hpp-study-buddy" -c user.email="hpp-study-buddy@maxapps.live" \
  commit -m "Sync content $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push origin main
