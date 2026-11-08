#!/usr/bin/env bash
# Renders community-post.html into out/community-post.png (1080x1350).
# Needs Microsoft Edge (or Chrome). Run from anywhere:
#   bash marketing/facebook/render-post.sh
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$dir/out"
browser="${BROWSER:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
page="file:///$(cygpath -m "$dir/community-post.html" 2>/dev/null || echo "$dir/community-post.html")"
png="$dir/out/community-post.png"

"$browser" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1080,1350 \
  --virtual-time-budget=2000 \
  --screenshot="$(cygpath -w "$png" 2>/dev/null || echo "$png")" \
  "$page" >/dev/null 2>&1
echo "$png"
