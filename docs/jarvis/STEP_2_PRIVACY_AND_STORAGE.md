# Jarvis — Step 2: privacy and Android storage access

Status: implementation on `feature/jarvis-step-2-storage-privacy`; draft PR #1 remains unmerged.

## Verified upstream facts

- Settings are persisted with Zustand + AsyncStorage in `src/stores/appStore.ts`.
- The original OGAM app had an opt-in PostHog analytics implementation, consent prompts and Settings controls.
- The original `SyncDownloadsModule.kt` already exposes `accessState()` and `requestAllFilesAccess()`, including a settings launch with fallback. It is the single native owner reused by Jarvis.
- `SyncDirectorySourceModule.kt` and Android's system document picker support user-selected folder access.
- `AndroidManifest.xml` already declares `MANAGE_EXTERNAL_STORAGE`, media permissions and legacy storage permissions.
- `MainApplication.kt` manually registers native React Native packages.
- `android/app/build.gradle` already has `useLegacyPackaging = true`; Step 2 does not change packaging.

## Privacy decisions

- Remote telemetry is disabled in the Jarvis fork. The analytics compatibility client is a no-op: it never initializes PostHog, creates a network connection, queues events or sends crash reports.
- The analytics consent prompt and Settings toggles are removed from the app UI. Existing event call sites can remain without sending data.
- The `posthog-react-native` dependency and its now-unneeded lockfile packages are removed.
- Do not add chat prompts, responses, transcripts, file contents or personal content to telemetry if a future, separately approved telemetry feature is introduced.
- Use SAF for user-selected files/folders. All-files access is optional and only opened after a user taps Manage and sees an explanation.
- The Storage settings screen displays the current all-files access state and rechecks it when the app returns to the foreground.
- Do not claim Play Store approval is guaranteed; distribution policy must be reviewed separately.

## Implementation

- `src/services/analytics/client.ts` preserves the existing analytics interface but implements it as a local no-op.
- `src/services/storagePermissionService.ts` wraps the existing `SyncDownloadsModule` API. It does not create another Android permission implementation.
- `src/screens/StorageSettingsScreen.tsx` adds the optional model-folder access explanation and explicit Settings action.
- The temporary duplicate `StoragePermissionModule` / `StoragePermissionPackage` was removed after discovering the existing Downloads bridge already provides the same native capability.
- `__tests__/unit/analytics/jarvisTransportDisabled.test.ts` verifies the remote analytics transport remains disabled.
- `__tests__/unit/services/storagePermissionService.test.ts` covers granted/denied state, explicit settings invocation, non-Android behavior and a missing native bridge.

## Verification still required

- GitHub CI must run TypeScript/lint, Jest and Android unit tests for the draft PR.
- The permission flow still needs a real Android 14/15 device check, including returning from Settings and confirming the refreshed state.
- Keep PR #1 draft and do not merge until the checks and target-device verification are reviewed.
