# Jarvis — Step 2: privacy and Android storage access

Status: implementation on `feature/jarvis-step-2-storage-privacy`; draft PR #1 remains unmerged.

## Verified upstream facts

- Settings are persisted with Zustand + AsyncStorage in `src/stores/appStore.ts`.
- Analytics consent defaults are false: `analyticsUsage: false` and `analyticsCrashes: false`.
- Analytics has an explicit Settings consent section and a consent prompt. The SDK is isolated behind `src/services/analytics/client.ts`; `startAnalytics` starts only after settings hydration.
- `posthog-react-native` remains a dependency because this fork has an established opt-in analytics implementation. This step does not silently remove the consent UI or Pro-related analytics hooks.
- `AndroidManifest.xml` already declares `MANAGE_EXTERNAL_STORAGE`, media permissions and legacy storage permissions.
- `SyncDirectorySourceModule.kt` and Android's system document picker support user-selected folder access.
- `SyncDownloadsModule.kt` already exposes `accessState()` and `requestAllFilesAccess()`, including a foreground-safe settings launch and fallback. It is the single native owner used by this step.
- `MainApplication.kt` manually registers native React Native packages.
- `android/app/build.gradle` already has `useLegacyPackaging = true`; Step 2 does not change packaging.

## Privacy decisions

- Analytics stays opt-in. Both usage analytics and crash reports default off. The existing consent flow is preserved rather than creating a second or conflicting consent store.
- No chat prompts, responses, transcripts, file contents or personal content are added to telemetry.
- Use SAF for user-selected files/folders. All-files access is optional and only opened after a user taps Manage and sees an explanation.
- The Storage settings screen displays the current all-files access state and rechecks it when the app returns to the foreground.
- Do not claim Play Store approval is guaranteed; distribution policy must be reviewed separately.

## Implementation

- `src/services/storagePermissionService.ts` wraps the existing `SyncDownloadsModule` API. It does not create another Android permission implementation.
- `src/screens/StorageSettingsScreen.tsx` adds the optional model-folder access explanation and explicit Settings action.
- The temporary duplicate `StoragePermissionModule` / `StoragePermissionPackage` was removed after discovering the existing Downloads bridge already provides the same native capability.
- `__tests__/unit/services/storagePermissionService.test.ts` covers granted/denied state, explicit settings invocation, non-Android behavior and a missing native bridge.

## Verification still required

- GitHub CI must run TypeScript/lint, Jest and Android unit tests for the draft PR.
- The permission flow still needs a real Android 14/15 device check, including returning from Settings and confirming the refreshed state.
- Keep PR #1 draft and do not merge until the checks and target-device verification are reviewed.
