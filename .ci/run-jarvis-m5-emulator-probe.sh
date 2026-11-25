#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$GITHUB_WORKSPACE/validation/android-native-probe"
DIAG="$ROOT/runtime-diagnostics"
APK="$ROOT/dist/Jarvis-M5-Memory.apk"

mkdir -p "$DIAG"
test -s "$APK"

adb install -r "$APK"
adb shell am force-stop com.jarvism5probe || true
adb logcat -c || true
adb shell am start -W -n com.jarvism5probe/.MainActivity | tee "$DIAG/am-start.txt"

for _ in $(seq 1 20); do
  adb logcat -d -v threadtime > "$DIAG/logcat.txt" || true
  if grep -qE '\[JARVIS_M5_PROBE\] (PASS|FAIL)|FATAL EXCEPTION|UnsatisfiedLinkError|TurboModuleRegistry' "$DIAG/logcat.txt"; then
    break
  fi
  sleep 3
done

sleep 3

adb shell pidof com.jarvism5probe > "$DIAG/process-id.txt" || true
adb shell dumpsys activity activities > "$DIAG/activities.txt" || true
adb logcat -d -v threadtime > "$DIAG/logcat.txt" || true
adb exec-out screencap -p > "$DIAG/launch-screen.png" || true
grep -E '\[JARVIS_M5_PROBE\] (PASS|FAIL)' "$DIAG/logcat.txt" > "$DIAG/probe-result.txt" || true

if grep -qE 'FATAL EXCEPTION|UnsatisfiedLinkError|TurboModuleRegistry|\[JARVIS_M5_PROBE\] FAIL' "$DIAG/logcat.txt"; then
  echo "Detected M5 Android probe startup or runtime failure in logcat:"
  grep -nE -C 4 'FATAL EXCEPTION|UnsatisfiedLinkError|TurboModuleRegistry|\[JARVIS_M5_PROBE\] FAIL' "$DIAG/logcat.txt" | tail -n 160 || true
  exit 1
fi

if ! test -s "$DIAG/process-id.txt"; then
  echo "Probe process com.jarvism5probe is not running after launch."
  exit 1
fi

if ! grep -q '\[JARVIS_M5_PROBE\] PASS ' "$DIAG/logcat.txt"; then
  echo "Expected [JARVIS_M5_PROBE] PASS marker was not found in emulator logcat."
  exit 1
fi

cat "$DIAG/probe-result.txt"
echo "Emulator OP-SQLite M5 native probe PASSED (pid $(cat "$DIAG/process-id.txt"))."
