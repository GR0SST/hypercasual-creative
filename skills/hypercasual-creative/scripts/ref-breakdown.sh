#!/usr/bin/env bash
# Break a reference video into shots + per-second frames + a contact sheet.
#   bash ref-breakdown.sh path/to/ref.mp4 [out_dir] [scene_threshold=0.3]
set -euo pipefail
J=(-q:v 3 -pix_fmt yuvj420p)
IN="$1"
NAME="$(basename "${IN%.*}")"
OUT="${2:-ref/$NAME}"
TH="${3:-0.3}"
mkdir -p "$OUT"

ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of compact "$IN" > "$OUT/info.txt"

# Scene cuts: timestamps + the first frame of every shot.
ffmpeg -v error -y -i "$IN" -vf "select='gt(scene,$TH)',metadata=print:file=$OUT/scenes.log" -fps_mode vfr "${J[@]}" "$OUT/cut_%03d.jpg" 2>/dev/null || true
{ echo "0.000"; [ -f "$OUT/scenes.log" ] && grep -o 'pts_time:[0-9.]*' "$OUT/scenes.log" | cut -d: -f2; } > "$OUT/cuts.txt" || true
ffmpeg -v error -y -i "$IN" -frames:v 1 "${J[@]}" "$OUT/cut_000.jpg"

# One frame per second, labelled with its time.
ffmpeg -v error -y -i "$IN" -vf "fps=1,scale=360:-2,drawtext=text='%{pts\:hms}':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6" "${J[@]}" "$OUT/sec_%03d.jpg" 2>/dev/null \
  || ffmpeg -v error -y -i "$IN" -vf "fps=1,scale=360:-2" "${J[@]}" "$OUT/sec_%03d.jpg"

# Contact sheet of the per-second frames (6 columns).
N=$(ls "$OUT"/sec_*.jpg | wc -l | tr -d ' ')
ROWS=$(( (N + 5) / 6 ))
ffmpeg -v error -y -framerate 1 -i "$OUT/sec_%03d.jpg" -vf "tile=6x${ROWS}:padding=4:color=black" -frames:v 1 "${J[@]}" "$OUT/sheet.jpg"

echo "shots: $(wc -l < "$OUT/cuts.txt" | tr -d ' ')  seconds: $N"
echo "$OUT/sheet.jpg  $OUT/cuts.txt  $OUT/cut_*.jpg  $OUT/sec_*.jpg"
