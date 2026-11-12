#!/usr/bin/env bash
# Renders slides.html into carousel PNGs, a video and a GIF.
# Needs Microsoft Edge (or Chrome) and ffmpeg. Run from anywhere:
#   bash marketing/facebook/render.sh
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
out="$dir/out"
mkdir -p "$out"

browser="${BROWSER:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
page="file:///$(cygpath -m "$dir/slides.html" 2>/dev/null || echo "$dir/slides.html")"

for n in 1 2 3 4 5 6; do
  "$browser" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1080 \
    --virtual-time-budget=2000 \
    --screenshot="$(cygpath -w "$out/slide-$n.png" 2>/dev/null || echo "$out/slide-$n.png")" \
    "$page?s=$n" >/dev/null 2>&1
  echo "slide-$n.png"
done

# Seconds each slide stays on screen. Text-heavy slides get longer.
durations=(4 8 6 7 7 6)
fade=0.6

inputs=()
for i in "${!durations[@]}"; do
  inputs+=(-loop 1 -t "${durations[$i]}" -i "$out/slide-$((i + 1)).png")
done

filter=""
offset=0
prev="0:v"
for i in 1 2 3 4 5; do
  offset=$(awk "BEGIN{print $offset + ${durations[$((i - 1))]} - $fade}")
  filter+="[$prev][$i:v]xfade=transition=fade:duration=$fade:offset=$offset[v$i];"
  prev="v$i"
done
filter+="[$prev]format=yuv420p[vout]"

ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$filter" -map "[vout]" \
  -r 30 -c:v libx264 -preset slow -crf 18 -movflags +faststart "$out/redflag-video.mp4"
echo "redflag-video.mp4"

ffmpeg -y -loglevel error -i "$out/redflag-video.mp4" \
  -vf "fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  "$out/redflag.gif"
echo "redflag.gif"
