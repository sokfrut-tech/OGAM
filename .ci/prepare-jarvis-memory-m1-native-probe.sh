#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
APP="$ROOT/validation/android-native-probe"
PIN="a267478a8bf6b290e71b3d86992852b0b192a58f"

git -C "$ROOT" merge-base --is-ancestor "$PIN" HEAD
mkdir -p "$APP/src/services" "$APP/src/utils"
rm -rf "$APP/src/services/jarvisMemory"
cp -a "$ROOT/src/services/jarvisMemory" "$APP/src/services/jarvisMemory"
cp "$ROOT/src/utils/generateId.ts" "$APP/src/utils/generateId.ts"
cp "$ROOT/src/utils/logger.ts" "$APP/src/utils/logger.ts"

test -s "$APP/src/services/jarvisMemory/database.ts"
test -s "$APP/src/services/jarvisMemory/repository.ts"
echo "Prepared standalone Android probe from pinned OGAM M1 source $PIN"
