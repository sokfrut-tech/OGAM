# OGAM — self-contained fork migration plan

Status: inventory confirmed on `feature/jarvis-step-2-storage-privacy`. No private source has been copied and no dependency has been replaced with a stub.

## Goal

Make `sokfrut-tech/OGAM` build and test from its own checkout, without credentials or runtime/build-time source checkouts from `off-grid-ai`.

## Confirmed external source dependencies

1. Git submodule `pro`
   - `.gitmodules` points to `https://github.com/off-grid-ai/mobile-pro.git`.
   - The current submodule gitlink points to commit `cae82b3df1ec751205359c351beb18b953404251`.
   - The repository API identifies this path as a submodule, not a normal directory.
2. Sibling workspace `../shared`
   - `package.json` declares nine local file dependencies:
     - `@offgrid/design`
     - `@offgrid/models`
     - `@offgrid/notes`
     - `@offgrid/notes-editor`
     - `@offgrid/rag`
     - `@offgrid/speech`
     - `@offgrid/sync`
     - `@offgrid/ui`
     - `@offgrid/writing`
   - `.github/actions/setup-mobile/action.yml` checks out `off-grid-ai/shared` beside the OGAM workspace and builds these packages.
3. Android APK workflow
   - `.github/workflows/build-android-apk.yml` currently requires `PRO_SUBMODULE_PAT` and passes it to the shared setup action.
   - This secret requirement is a consequence of the two external source dependencies above, not a desired permanent OGAM configuration.

## Public fork research (2026-11-22)

Inspected two public forks rather than assuming how other developers solved unavailable private repositories.

### `wednesday-solutions/off-grid-mobile-ai`

- Public fork, created 2026-03-17; repository metadata reports its last push on 2026-03-17.
- Its `package.json` is version `0.0.81`.
- The inspected tree has no `.gitmodules` and no `pro` directory.
- Its package manifest does not declare the newer `@offgrid/*` sibling-workspace dependencies.
- This is a useful example of a standalone earlier open-core snapshot, but it does **not** prove that the maintainer removed current private dependencies: it predates the newer Pro/shared split and is not current parity with this OGAM branch.
- Potential use: compare its self-contained open-core implementation and tests for features that remain relevant. Do not replace our current branch wholesale with this old snapshot.

### `cristiannegru/off-grid-mobile-ai`

- Public fork of OGAM; current inspected tree contains `pro` as a submodule pinned to `ff0d874`.
- Its `.gitmodules` still points `pro` to `https://github.com/off-grid-ai/mobile-pro.git`; it has not made Pro self-contained.
- Its `package.json` still declares sibling `../shared` dependencies (including application, models, rag, speech, sync and ui).
- Its CI workflow documents a fork mode: when `PRO_SUBMODULE_PAT` is absent, private-source checkout steps are skipped and Pro-dependent test suites are skipped in favor of the open-core suite. When the secret is present, CI checks out matching Pro/shared branches with main fallback.
- This is a practical CI workaround for contributors without private-source access, **not** a full dependency migration. It does not satisfy OGAM's goal of a clean self-contained checkout.

### Research conclusion

There are two distinct approaches visible in public forks:

1. Earlier standalone core snapshot: omit Pro and newer shared-workspace integration; retain only features whose source is actually present in the fork.
2. Contributor CI fallback: conditionally skip private Pro/shared integration and run open-core checks; useful temporarily, but does not make the project independent.

For our stated goal, use the first approach as architectural evidence and the second only as a temporary test strategy. The target remains a real, fully tested OGAM-owned implementation with no private checkout token. Do not claim full independence while Pro or shared code is absent.

## Access finding

The connected GitHub integration can read `sokfrut-tech/OGAM`, but requests for `off-grid-ai/mobile-pro` and `off-grid-ai/shared` return 404. Their source contents therefore have not been inspected or copied. Do not create empty placeholder directories, fake packages, or no-op Pro implementations to make CI appear green.

## Migration sequence

1. Obtain legitimate source exports or authorized repository transfers for the exact pinned Pro submodule commit and the shared revision used by this OGAM branch.
2. Vendor the required source into OGAM-owned paths (for example `vendor/pro` and `packages/shared/*`) while preserving license notices, attribution, and any distribution restrictions. If redistribution is not permitted, replace each dependency with an independently implemented OGAM-owned equivalent rather than copying restricted source.
3. Rewrite all `file:../shared/...` package references, TypeScript/Jest/Metro aliases, scripts, Gradle hooks, and CI setup to use the in-repository paths.
4. Remove the `pro` git submodule and its gitlink only after all imports, tests, build scripts, and runtime entry points have been migrated.
5. Remove the private checkout/token logic from `.github/actions/setup-mobile/action.yml` and the `PRO_SUBMODULE_PAT` gate from the APK workflow.
6. Run dependency install from a clean checkout, then TypeScript, ESLint, Jest, dependency-cruiser/knip, actionlint, Android unit tests, and arm64 debug APK build.
7. Search the entire repository and CI configuration for `off-grid-ai/`, `PRO_SUBMODULE_PAT`, `../shared`, and `git submodule`; require zero build-time references before calling OGAM self-contained.

## Safety and release gates

- Keep PR #1 as draft; do not merge to unblock manual workflow dispatch.
- Do not publish a build until the APK is built from a clean OGAM-only checkout and the artifact checksum is recorded.
- Audit the licenses and redistribution rights for Pro, shared packages, and bundled native/QNN assets before distributing the resulting APK.
- A successful build must exercise real functionality; stubs or skipped suites do not count as migration completion.

## Current blockers

- Authorized source material for the pinned Pro commit and the shared workspace revision is not available through the current GitHub connection.
- The exact shared commit/ref used by the existing setup action is selected dynamically from the matching branch or its base branch; it must be recorded before copying so the migration is reproducible.
