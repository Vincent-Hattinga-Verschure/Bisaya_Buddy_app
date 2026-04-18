#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-generic}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DERIVED_DATA="$ROOT_DIR/.build/ios-derived-data"

cd "$ROOT_DIR"

DESTINATION="generic/platform=iOS"
EXTRA_ARGS=("CODE_SIGNING_ALLOWED=NO")

if [[ "$MODE" == "sim" ]]; then
  DESTINATION="generic/platform=iOS Simulator"
  EXTRA_ARGS=()
fi

xcodebuild \
  -project "$ROOT_DIR/BisayaBuddyIOS.xcodeproj" \
  -scheme "BisayaBuddyIOS" \
  -configuration Debug \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA" \
  "${EXTRA_ARGS[@]}" \
  build
