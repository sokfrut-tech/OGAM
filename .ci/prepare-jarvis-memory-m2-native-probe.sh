#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
APP="$ROOT/validation/android-native-probe"
PIN_M1="a267478a8bf6b290e71b3d86992852b0b192a58f"

git -C "$ROOT" merge-base --is-ancestor "$PIN_M1" HEAD
mkdir -p "$APP/src/services" "$APP/src/components/jarvisMemory" "$APP/src/utils"
rm -rf "$APP/src/services/jarvisMemory"
cp -a "$ROOT/src/services/jarvisMemory" "$APP/src/services/jarvisMemory"
cp "$ROOT/src/components/jarvisMemory/MemoryProposalCard.tsx" "$APP/src/components/jarvisMemory/MemoryProposalCard.tsx"
cp "$ROOT/src/utils/generateId.ts" "$APP/src/utils/generateId.ts"
cp "$ROOT/src/utils/logger.ts" "$APP/src/utils/logger.ts"

test -s "$APP/src/services/jarvisMemory/secretGuard.ts"
test -s "$APP/src/services/jarvisMemory/repository.ts"
test -s "$APP/src/services/jarvisMemory/confirmationController.ts"
test -s "$APP/src/components/jarvisMemory/MemoryProposalCard.tsx"
echo "Prepared standalone M2 Android probe from OGAM checkout at $(git -C "$ROOT" rev-parse --short HEAD)"
