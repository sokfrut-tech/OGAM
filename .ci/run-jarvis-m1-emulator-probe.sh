#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$GITHUB_WORKSPACE/validation/android-native-probe"
DIAG="$ROOT/runtime-diagnostics"
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
mkdir -p "$DIAG"
test -s "$APK"
adb install -r "$APK"
adb shell am force-stop com.jarvism1probe
adb shell monkey -p com.jarvism1probe 1
sleep 25
adb shell pidof com.jarvism1probe > "$DIAG/process-id.txt" || true
adb shell dumpsys activity activities > "$DIAG/activities.txt"
adb logcat -d -v threadtime > "$DIAG/logcat.txt"
adb exec-out screencap -p > "$DIAG/launch-screen.png" || true
if grep -qE 'FATAL EXCEPTION|UnsatisfiedLinkError|ReactNativeJS.*(Error|error)|TurboModuleRegistry' "$DIAG/logcat.txt"; then
  echo "Potential startup crash signature found; see logcat artifact."
  grep -nE -C 4 'FATAL EXCEPTION|UnsatisfiedLinkError|ReactNativeJS.*(Error|error)|TurboModuleRegistry' "$DIAG/logcat.txt" | tail -n 160 || true
  exit 1
fi
echo "No common fatal React Native/native crash signature found in emulator log."
test -s "$DIAG/process-id.txt"
echo "App process is alive: $(cat "$DIAG/process-id.txt")"
