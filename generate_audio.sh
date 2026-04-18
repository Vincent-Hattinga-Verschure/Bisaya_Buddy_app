#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIO_DIR="$SCRIPT_DIR/audio"
VOICE="Eddy (English (US))"
RATE="168"

mkdir -p "$AUDIO_DIR"

generate_clip() {
  local name="$1"
  local text="$2"
  local temp_file

  temp_file="$(mktemp /tmp/bisaya-buddy-XXXXXX.aiff)"
  say -v "$VOICE" -r "$RATE" -o "$temp_file" "$text"
  afconvert -f WAVE -d LEI16@22050 "$temp_file" "$AUDIO_DIR/$name.wav" >/dev/null 2>&1
  rm -f "$temp_file"
}

node <<'NODE' | while IFS=$'\t' read -r name text; do
global.window = {};
require("./lesson-data.js");

for (const item of window.lessonEntries) {
  console.log(`${item.id}\t${item.tts}`);
}
NODE
  generate_clip "$name" "$text"
done

echo "Audio clips generated in $AUDIO_DIR"
