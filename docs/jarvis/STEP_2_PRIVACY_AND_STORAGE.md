# Jarvis — Step 2: privacy and Android storage access

Status: implementation started on `feature/jarvis-step-2-storage-privacy`.

## Verified upstream facts

- The app already persists settings with Zustand + AsyncStorage in `src/stores/appStore.ts`.
- Analytics consent defaults are already false: `analyticsUsage: false` and `analyticsCrashes: false`. The existing schema also has consent-prompt bookkeeping fields.
- `posthog-react-native` is still a dependency in `package.json`; removing the dependency alone is unsafe until all imports, initialization paths, consent UI and tests have been located.
- `AndroidManifest.xml` already declares `MANAGE_EXTERNAL_STORAGE`, as well as media permissions and legacy storage permissions.
- The manifest already includes SAF-oriented directory integration. `SyncDirectorySourceModule.kt` enumerates a user-granted document tree and can stage a selected document into app-private storage.
- `MainApplication.kt` manually registers native React Native packages.
- `android/app/build.gradle` already has `useLegacyPackaging = true`; Step 2 does not change packaging.

## Privacy decision

Jarvis will not silently request broad storage access. Use the Storage Access Framework for user-selected folders/files wherever possible. All-files access is a special permission and should only be opened after a clear user action and an explanation of the model-scanning use case. Do not claim Play Store approval is guaranteed; distribution policy must be reviewed separately.

## Native bridge added

- `StoragePermissionModule`: checks `Environment.isExternalStorageManager()` on Android 11+ and opens the app-specific `Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION` screen only when called explicitly.
- `StoragePermissionPackage`: React Native package wrapper.
- The module does not prompt on startup and does not claim that the user granted permission merely because settings opened. The caller must check again when the app resumes.

## Telemetry disposition

The fork currently has analytics disabled by default, but the PostHog SDK remains in dependencies. Full removal is deliberately not performed until all call sites, consent UI, crash handling and tests are audited. No chat prompts, responses, transcripts, model names, file paths or personal content may be introduced into telemetry during this work.

## Verification still required

- Run Android Kotlin compilation and unit tests in CI.
- Add a JS wrapper that checks permission and exposes the settings action.
- Verify the permission flow on Android 14/15 on the target OPPO device.
- Audit all PostHog references before removing SDK and consent UI.
