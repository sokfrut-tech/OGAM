# Jarvis — Step 7: Russian localization

Status: lightweight English/Russian dictionaries and device-locale helper committed on `feature/jarvis-step-2-storage-privacy`.

## Implementation

- Add `src/i18n/en.json` and `src/i18n/ru.json` with matching keys for the new Local Model Library, Image Generator and Android storage permission controls.
- Add `src/i18n/index.ts` with `t(key, values)`, placeholder interpolation and device-locale detection.
- Russian is selected when the device locale begins with `ru`; other locales fall back to English.
- No third-party i18n dependency was added.
- Localize the new screens and entry-point accessibility labels. Existing OGAM screens outside this work remain in their original language and are not claimed to be fully translated.

## Scope and limitations

- Locale follows the device setting; there is not yet an in-app language selector.
- The helper uses the native locale values exposed by React Native on iOS/Android. If a platform does not expose a locale, it safely falls back to English.
- The two JSON dictionaries currently have matching key sets.

## Files

- `src/i18n/index.ts`
- `src/i18n/en.json`
- `src/i18n/ru.json`
- `src/screens/ImageGenScreen.tsx`
- `src/screens/LocalModelsScreen.tsx`
- `src/screens/StorageSettingsScreen.tsx`
- `src/screens/ModelsScreen/index.tsx`

## Verification

- English and Russian key sets were compared programmatically and match.
- Runtime locale detection and Android/iOS rendering still require device verification.
- GitHub Actions has not run the branch's tests or TypeScript check.
