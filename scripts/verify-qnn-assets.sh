#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QNN_DIR="$ROOT/android/app/src/main/assets/qnnlibs"

required=(
  libQnnHtp.so
  libQnnSystem.so
  libstable_diffusion_core.so
  libQnnHtpV68.so libQnnHtpV68Stub.so libQnnHtpV68Skel.so
  libQnnHtpV69.so libQnnHtpV69Stub.so libQnnHtpV69Skel.so
  libQnnHtpV73.so libQnnHtpV73Stub.so libQnnHtpV73Skel.so
  libQnnHtpV75.so libQnnHtpV75Stub.so libQnnHtpV75Skel.so
  libQnnHtpV79.so libQnnHtpV79Stub.so libQnnHtpV79Skel.so
  libQnnHtpV81.so libQnnHtpV81Stub.so libQnnHtpV81Skel.so
)

missing=()
for name in "${required[@]}"; do
  if [[ ! -s "$QNN_DIR/$name" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf 'Missing or empty QNN runtime asset(s) in %s:\n' "$QNN_DIR" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

printf 'Verified %d QNN/HTP runtime assets for Android packaging.\n' "${#required[@]}"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$QNN_DIR" && sha256sum "${required[@]}")
fi
