#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
APP="$ROOT/validation/android-native-probe"
PIN_M2="276f2f2ca489122b9145410b9552a199683604b3"

git -C "$ROOT" merge-base --is-ancestor "$PIN_M2" HEAD
mkdir -p "$APP/src/services" "$APP/src/components" "$APP/src/utils"
rm -rf "$APP/src/services/jarvisMemory" "$APP/src/components/jarvisMemory"
cp -a "$ROOT/src/services/jarvisMemory" "$APP/src/services/jarvisMemory"
cp -a "$ROOT/src/components/jarvisMemory" "$APP/src/components/jarvisMemory"
cp "$ROOT/src/utils/generateId.ts" "$APP/src/utils/generateId.ts"
cp "$ROOT/src/utils/logger.ts" "$APP/src/utils/logger.ts"

test -s "$APP/src/services/jarvisMemory/managementService.ts"
test -s "$APP/src/services/jarvisMemory/retrievalService.ts"
test -s "$APP/src/services/jarvisMemory/secretGuard.ts"
test -s "$APP/src/services/jarvisMemory/repository.ts"
test -s "$APP/src/services/jarvisMemory/confirmationController.ts"
test -s "$APP/src/components/jarvisMemory/MemoryProposalCard.tsx"
test -s "$APP/src/components/jarvisMemory/MemoryManagerPanel.tsx"
echo "Prepared standalone M3+M4 Android probe from OGAM checkout at $(git -C "$ROOT" rev-parse --short HEAD)"
