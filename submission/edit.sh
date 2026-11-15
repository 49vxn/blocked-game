#!/usr/bin/env bash
# Blocked demo: cut the takes, add a title card and an end card, render one MP4.
#
#   bash edit.sh raw-survival.mkv raw-bedwars.mkv menu.mkv
#
# Only the IN/LEN numbers below should need changing: they are seconds into each
# take. Run `ffprobe -v error -show_entries format=duration raw-survival.mkv` if
# you need to know how long a take is.
set -euo pipefail

SURV=${1:-raw-survival.mkv}
BED=${2:-raw-bedwars.mkv}
MENU=${3:-menu.mkv}
OUT=${OUT:-blocked-demo.mp4}

# --- the beats, in seconds into each take ------------------------------------
S1_IN=4;   S1_LEN=14   # courtyard walk
S2_IN=26;  S2_LEN=16   # disaster warning and impact
S3_IN=48;  S3_LEN=14   # flood: hearts dropping
S4_IN=66;  S4_LEN=12   # shove a bot
S5_IN=84;  S5_LEN=12   # supply drop
B1_IN=6;   B1_LEN=18   # bed wars islands
# -----------------------------------------------------------------------------

command -v ffmpeg >/dev/null || { echo "ffmpeg not found: winget install Gyan.FFmpeg" >&2; exit 1; }

FONT="C\\:/Windows/Fonts/arialbd.ttf"
[ -f "/c/Windows/Fonts/arialbd.ttf" ] || FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
[ -f "$FONT" ] || FONT=""

NORM="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=60,setsar=1"

has_audio() {
  ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1" 2>/dev/null | grep -q .
}

# clip <file> <in> <len> <out> — everything normalised so the concat is legal.
clip() {
  local f=$1 in=$2 len=$3 out=$4
  if has_audio "$f"; then
    ffmpeg -y -v error -ss "$in" -t "$len" -i "$f" \
      -vf "$NORM" -af "aresample=async=1:first_pts=0" \
      -c:v libx264 -crf 18 -preset veryfast -pix_fmt yuv420p -r 60 \
      -c:a aac -b:a 160k -ar 48000 -ac 2 "$out"
  else
    ffmpeg -y -v error -ss "$in" -t "$len" -i "$f" \
      -f lavfi -t "$len" -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
      -map 0:v:0 -map 1:a:0 -vf "$NORM" \
      -c:v libx264 -crf 18 -preset veryfast -pix_fmt yuv420p -r 60 \
      -c:a aac -b:a 160k -ar 48000 -ac 2 -shortest "$out"
  fi
}

# card <line1> <line2> <seconds> <out> — dark card with two centred lines.
card() {
  local one=$1 two=$2 dur=$3 out=$4
  local draw="drawtext=text='$one':fontcolor=0xdce8cc:fontsize=96:x=(w-tw)/2:y=(h-th)/2-70"
  [ -n "$FONT" ] && draw="drawtext=fontfile='$FONT':text='$one':fontcolor=0xdce8cc:fontsize=96:x=(w-tw)/2:y=(h-th)/2-70"
  local draw2="drawtext=text='$two':fontcolor=0x9fb08f:fontsize=44:x=(w-tw)/2:y=(h-th)/2+60"
  [ -n "$FONT" ] && draw2="drawtext=fontfile='$FONT':text='$two':fontcolor=0x9fb08f:fontsize=44:x=(w-tw)/2:y=(h-th)/2+60"
  ffmpeg -y -v error \
    -f lavfi -i "color=c=0x16201a:s=1920x1080:r=60" \
    -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
    -t "$dur" -vf "$draw,$draw2" \
    -c:v libx264 -crf 18 -preset veryfast -pix_fmt yuv420p \
    -c:a aac -b:a 160k -ar 48000 -ac 2 -shortest "$out"
}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
echo "working in $WORK"

clip "$SURV" "$S1_IN" "$S1_LEN" "$WORK/01.mp4"
clip "$SURV" "$S2_IN" "$S2_LEN" "$WORK/02.mp4"
clip "$SURV" "$S3_IN" "$S3_LEN" "$WORK/03.mp4"
clip "$SURV" "$S4_IN" "$S4_LEN" "$WORK/04.mp4"
clip "$SURV" "$S5_IN" "$S5_LEN" "$WORK/05.mp4"
clip "$BED"  "$B1_IN" "$B1_LEN" "$WORK/06.mp4"
[ -f "$MENU" ] && clip "$MENU" 0 4 "$WORK/00.mp4" || card "BLOCKED" "The school falls down. Last one standing wins." 4 "$WORK/00.mp4"
card "BLOCKED" "Two games, one school.  49vxn.github.io/blocked-game" 4 "$WORK/99.mp4"

: > "$WORK/list.txt"
for f in "$WORK"/00.mp4 "$WORK"/01.mp4 "$WORK"/02.mp4 "$WORK"/03.mp4 "$WORK"/04.mp4 "$WORK"/05.mp4 "$WORK"/06.mp4 "$WORK"/99.mp4; do
  [ -f "$f" ] && echo "file '$f'" >> "$WORK/list.txt"
done

ffmpeg -y -v error -f concat -safe 0 -i "$WORK/list.txt" -c copy -movflags +faststart "$OUT"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo "wrote $OUT (${DUR}s)"
awk -v d="$DUR" 'BEGIN { if (d > 120) print "WARNING: over two minutes — trim a beat in the script"; else print "under two minutes: good" }'
