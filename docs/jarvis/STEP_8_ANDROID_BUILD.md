# Jarvis — Step 8: Android build configuration and APK workflow

Status: a safe, manual, arm64 debug-APK workflow is committed. It does not publish a release, bump the app version, push to a branch, or require a signing keystore.

## Verified existing OGAM Android toolchain

The fork's actual Gradle files were inspected before adding a workflow:

- Java: 17 (the repository's `.github/actions/setup-android` pins Temurin 17)
- Gradle wrapper: 8.13, with distribution SHA-256 validation
- Android Gradle Plugin: 8.8.2
- Kotlin Gradle Plugin: 2.4.0
- NDK: 27.1.12297006 (pinned in `android/build.gradle` and installed by the shared setup action)
- CMake: 3.22.1 (pinned in `android/app/build.gradle`)
- compileSdk / targetSdk: 36
- minSdk: 24
- React Native architectures: `arm64-v8a,x86_64`; the Jarvis APK workflow explicitly builds `arm64-v8a`
- Hermes enabled
- `useLegacyPackaging = true` and `extractNativeLibs = true` are already configured for native runtime libraries
- `libOpenCL.so` is excluded from APK packaging so the device-provided Qualcomm OpenCL loader is used
- Native video CMake requires the pinned stable-diffusion.cpp source, shaderc, and Hexagon DSP build inputs before Android CMake configuration.

The original planning note proposed NDK 26.1.10909125, but that is not the NDK used by this OGAM revision. The build workflow intentionally preserves the checked-in 27.1.12297006 pin rather than introducing a toolchain mismatch.

## New workflow

File: `.github/workflows/build-android-apk.yml`

- Trigger: manual `workflow_dispatch` only.
- Builds a debug APK for `arm64-v8a`, suitable for installation/testing on the OPPO Find X6 Pro.
- Uses the repository's shared workspace setup and pinned Android toolchain/video-runtime action.
- Verifies the APK exists, writes a SHA-256 checksum, and uploads both as a 14-day GitHub Actions artifact.
- Does not create a GitHub Release, alter versions, push commits, or upload to Play Store.
- No release keystore or Play Store credentials are needed.

## Private workspace dependency

OGAM declares local workspace dependencies under `file:../shared/packages/*` and uses the private `off-grid-ai/mobile-pro` submodule. The existing setup action needs the `PRO_SUBMODULE_PAT` Actions secret with read access to both `off-grid-ai/mobile-pro` and `off-grid-ai/shared`. The new workflow checks for this secret before starting dependency installation and fails with an explicit message if it is absent. It does not replace private packages with stubs or bypass Pro licensing.

## Qualcomm / Hexagon boundaries

The workflow builds OGAM's checked-in Hexagon video runtime. This is separate from the Qualcomm QNN runtime libraries used by local-dream image generation.

The existing `android/app/src/main/assets/qnnlibs/` tree already contains the common `libQnnHtp.so` and `libQnnSystem.so`, HTP backend binaries for V68/V69/V73/V75/V79/V81, and the matching Stub/Skel pairs. The native LocalDream module explicitly passes `libQnnHtp.so` and `libQnnSystem.so` to the backend and copies the qnnlibs asset directory to app-private runtime storage. The current tree does **not** contain `libQnnHtpPrepare.so`; a repository code search found no reference to that filename. The APK workflow verifies the actual 21-file runtime manifest rather than silently adding an unreferenced placeholder. The QNN asset provenance and redistribution rights still need a separate license audit; this build change adds no Qualcomm binaries.

## Verification and execution status

- Gradle and Android toolchain versions were read from the checked-in configuration.
- Workflow file and artifact paths were reviewed against the existing setup actions and Gradle output layout.
- No APK build has been executed yet.
- The latest completed CI attempt (run 12) passed actionlint and native video helper tests, but failed ESLint on one inline style in the new storage-permission row; that style was extracted into the existing theme-aware style system in the next commit.
- TypeScript, Jest, dependency-cruiser and knip could not resolve the private `../shared` workspace or `pro/` submodule. The Actions log confirms the `PRO_SUBMODULE_PAT` input was empty, so the setup action skipped both private checkouts. The resulting module/type errors are environment/dependency failures, not a valid source verification.
- A new CI run was queued for the subsequent commit; its result is not yet available.
- The workflow is on the feature branch and is not yet present on the repository default branch. GitHub's manual workflow dispatch requires the workflow file to exist on the default branch, so it cannot be dispatched until this PR is merged. This PR remains draft; no merge is performed without the user's explicit approval.
- A successful CI/unit-test run, Android APK build, APK install test and OPPO Find X6 Pro verification remain outstanding.
