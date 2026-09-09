# Web target — hosted PWA + offline single file

**Datum:** 2026-09-09
**Status:** proposed
**Autor:** Thomas Thiessenhusen (via Claude Code)

## Context

Bockzettel currently ships as a native app for Android (Windows environment) and iOS
(macOS environment) from a shared `main`. Getting it onto a device requires a build
toolchain, a cable or a store — which makes it awkward to hand to the other players at
the table.

The codebase is already well positioned for a browser target:

- `src/domain/**` and `src/application/**` are platform-neutral TypeScript.
- `src/data/local/localStorage.ts` defines an async `LocalStorage` interface whose doc
  comment explicitly anticipates swapping implementations.
- `react-native-web` and `react-dom` are already dependencies; `npm run web` exists;
  `app.json` already declares `web.output: "single"`.

Nine files touch platform APIs. Three need real web implementations, two are layering
violations that need a seam first, and four already work on the web.

### Verified baseline (2026-09-09)

Measured on the Windows environment after `npm ci` (1199 packages, 31 s, gradle-plugin
patch applied cleanly):

- `npm run typecheck` — clean.
- `npm run lint` — 0 errors, 101 warnings, all `@typescript-eslint/array-type` style
  (`Array<T>` instead of `T[]`); 91 are auto-fixable and deliberately left alone so they
  do not muddy this branch.
- `npm test` — 27 suites, 196 tests, all passing in under 2 s.
- Toolchain: Node 24.15.0, npm 11.12.1, JDK 21.0.10, adb 1.0.41, Android SDK platforms
  35/36/36.1, AVD `Pixel_10` available.

**Not yet verified:** neither `npm run android` nor `npm run ios` has been run from this
clone, so there is no "before" snapshot of the native targets. That should happen before
any code in this spec is implemented — otherwise a later native regression cannot be
attributed.

## Goal

Add **web** as a third build target on the same `main`, at full feature parity, producing
two artefacts:

1. **Hosted PWA** (primary) — a static site on GitHub Pages. Open a link on any device,
   add to home screen, works offline after first visit.
2. **Single self-contained HTML file** (fallback) — one file to hand around by email,
   messenger or USB stick. Runs from `file://` with no network at all.

## Decisions

Taken during brainstorming on 2026-09-09:

| Question | Decision |
|---|---|
| Distribution | Hosted URL primary, single file as offline fallback |
| Relation to native app | Third target on the same `main`; full code reuse, full parity |
| Persistence in the single file | Session-only; data in and out via the existing JSON export/import |
| First increment | Full parity in one pass |
| Pipeline | Metro / Expo web export — one bundler, the mechanism `CLAUDE.md` already prescribes |

Vite plus `react-native-web` was considered and rejected for now: `vite-plugin-pwa` and
`vite-plugin-singlefile` would hand us both remaining requirements for free, but a second
bundler in a repo whose central rule is cross-environment buildability adds a seam where
Metro and Vite can disagree about what a bare `react-native` import resolves to. It stays
the escape hatch if the post-export inlining proves unmaintainable.

A slim hand-written UI over `src/domain` only was also rejected: it contradicts the
full-parity, single-codebase decision.

## Out of scope (YAGNI)

- Any server, account or cross-device sync. The web app and the native apps are separate
  data silos, bridged by the existing JSON export/import round-trip.
- ~~Deleting the stranded files under `app/`~~ — **done before this spec's implementation**,
  because it turned out to be the sole cause of `npm run lint` failing (six
  `import/no-unresolved` errors). Ten files, leftovers of the expo-router to
  react-navigation migration in `8297b25`. Removed in its own commit together with the
  now-unnecessary `tsconfig.json` exclude.
- Icon-font subsetting. Only if the single-file size measurement comes out badly.
- Component rendering tests. The project has none today and this change does not need
  them.

## Architecture — platform seams

All platform-specific code goes behind file-suffix pairs (`foo.ts` / `foo.web.ts`), the
mechanism already documented in `CLAUDE.md`. Metro resolves the suffix per target, so
there is no runtime `Platform.OS` branching for these and the unused implementation never
enters the bundle.

### New seams

| Module | Native | Web |
|---|---|---|
| `src/data/local/createStorage.ts` | returns `createJsonFileStorage()` | returns the probing storage (below) |
| `src/data/local/readTextFile.ts` | `FileSystem.readAsStringAsync(uri)` | `fetch(uri)` then `r.text()` |
| `src/data/import/pickImportFile.ts` | `DocumentPicker.getDocumentAsync` | hidden `<input type="file">` + `URL.createObjectURL` |
| `src/data/export/fileShare.web.ts` | *(exists)* | `Blob` + `<a download>`; `navigator.share` when available |
| `src/data/export/pdfShare.web.ts` | *(exists)* | hidden iframe + `window.print()` |

All five expose the signatures their native counterparts already have, so callers are
unchanged apart from the import path.

### Changes to existing modules

**`src/application/stores/repositories.ts:25`** hardcodes `createJsonFileStorage()`. It
imports `createStorage` instead and calls it. One line; the platform choice moves to the
module resolver. The file itself stays shared by all three targets.

**`src/data/export/pdfShare.ts:116`** holds `buildHtml`, roughly 200 lines of pure
string-building that is module-private and therefore untested. It moves to
`src/application/export/sheetHtml.ts` as a platform-neutral, exported, pure function.
Both `pdfShare.ts` and `pdfShare.web.ts` import it. The web adapter then needs only the
~15 lines that put that HTML into an iframe and print it.

**`src/presentation/screens/SettingsScreen.tsx:5`** drops its `expo-document-picker`
import in favour of `pickImportFile()`.

**`src/presentation/screens/ImportReviewScreen.tsx:67`** drops its
`expo-file-system/legacy` import in favour of `readTextFile()`.

Both screens then know nothing about file systems again, which is what the layering
intended.

**Platform gates.** `SettingsScreen.tsx:102`, `SettingsScreen.tsx:106`,
`SheetScreen.tsx:244`, `SheetScreen.tsx:273`, `GroupManagementScreen.tsx:157` and
`GroupManagementScreen.tsx:173` gate the "save as…" affordances on
`Platform.OS === 'android'`. They become `Platform.OS !== 'ios'`, so the buttons reappear
on the web, where a browser download is the correct equivalent.

### Deliberate non-change

The picked-file URI keeps travelling through the navigation param from `SettingsScreen` to
`ImportReviewScreen`. On the web that is a `blob:` URL, valid for the lifetime of the
document — so in-app navigation works, but a hard reload while sitting on the
import-review route loses it. The native build has the same hole today with cache URIs.
Passing file *contents* through the param instead would be cleaner but churns
`RootStackParamList`; not worth it here.

## Storage on the web

`expo-file-system/legacy` has no web implementation, so this seam is load-bearing: without
it the web bundle does not build at all.

### IndexedDB implementation

`src/data/local/idbStorage.ts` implements `LocalStorage` over IndexedDB. The interface is
already fully async, so no caller changes.

- One database, one object store.
- Key: the collection name, a slash, then the id.
- `readAll(collection)` is a key-range scan over the `collection/` prefix
  (`IDBKeyRange.bound(prefix, prefix + high-sentinel)`) — no secondary index needed.
- Corrupt or unparseable records are skipped, matching `jsonFileStorage`'s behaviour of
  not letting one bad entry kill the list.

This mirrors `jsonFileStorage`'s one-record-per-key model, so the two implementations stay
mentally interchangeable. Estimated ~90 lines, no new runtime dependency.

IndexedDB is chosen over the browser's own `localStorage` because the latter is
synchronous (blocking the UI thread on every write), capped around 5 MB, and the first
store a browser evicts under pressure.

### In-memory implementation

For the `file://` artefact, where IndexedDB is unavailable.
`__tests__/data/_inMemoryStorage.ts` already implements this exact interface; it is
promoted to `src/data/local/memoryStorage.ts` and serves both the tests and the offline
file.

### Runtime capability probe

The same bundle serves both artefacts, so the choice cannot be made at bundle time.

`createStorage.web.ts` returns a `LocalStorage` **synchronously**, whose four methods each
await an internal `ready` promise that resolves to the winning delegate — IndexedDB if it
opens, `memoryStorage` if it throws. This keeps `repositories.ts` free to build its
singletons at import time, as it does today, so the file shared with the native targets
needs no async rework.

Alongside it, `createStorage.web.ts` exports `storageMode`, a promise resolving to
`'indexeddb'` or `'memory'`. The UI awaits it and shows a persistent banner when memory
storage won: *this session only — export before closing the tab*.

### Persistence and its limits

Browser storage is evictable. The hosted variant requests `navigator.storage.persist()`
once at startup, which moves the origin into the "do not evict under pressure" bucket in
Chrome and Firefox. This is a mitigation, not a guarantee; the honest backstop is the JSON
export that already exists.

The web app and the native apps hold **separate data** with no synchronisation. Moving a
sheet between them is an explicit export/import, already covered by
`__tests__/integration/exportImportRoundtrip.test.ts`.

## Build and deploy

### Export

`npx expo export --platform web` against the existing `web.output: "single"` produces
`dist/` — `index.html` plus a fingerprinted bundle under `_expo/static/`.

Note the interaction with the offline artefact below: `baseUrl` prefixes every asset
reference with `/doppelkopf-schreiber/`, which is correct for Pages and wrong for a file
opened from disk. The inliner must therefore embed **every** referenced asset and leave no
prefixed URL behind — a single stray reference would fail silently on `file://`. The
verification checklist covers this by opening the file with the network disabled.

### GitHub Pages

Two traps to disarm up front:

1. Project pages serve from `/doppelkopf-schreiber/`, but the export writes root-absolute
   asset paths. Fixed by setting `expo.experiments.baseUrl` in `app.json`.
2. Pages runs Jekyll, which silently skips directories whose names begin with an
   underscore — and Expo emits `_expo/`. Without a `.nojekyll` file in `dist/`, the site
   deploys successfully and then loads nothing.

### Post-export script

`scripts/postexport.mjs`, run after `expo export`, does three things to `dist/`:

1. Writes `.nojekyll`.
2. Injects into `index.html`: the `manifest.webmanifest` link, the service-worker
   registration, and the `apple-mobile-web-app-capable` / `apple-touch-icon` tags iOS
   needs for a real home-screen launch. (`output: "single"` leaves no template to edit,
   hence injection.)
3. Emits `bockzettel-offline.html` — the single-file artefact: JS and CSS inlined, the
   MaterialCommunityIcons font embedded as a base64 `@font-face` data URI, no service
   worker (unavailable on `file://`).

The manifest reuses `assets/images/` and the `#1B5E20` theme colour from the Android
adaptive icon. The service worker is cache-first over the fingerprinted bundle with a
network fallback — roughly 40 lines, no Workbox.

**Expected single-file size: 3–4 MB** (about 1.5–2.5 MB of JS from react-native-web,
Paper and navigation, plus about 1.5 MB once the icon font inflates by a third under
base64). Emailable but not small. This is a measurement to take, not a promise; if it
lands badly, subsetting the icon font to the glyphs actually used is the lever.

### CI

`.github/workflows/ci.yml` has failed on every push since 2026-05-19 (13–16 s per run) —
`ci.yml:27` installed with `pnpm install --frozen-lockfile` while the repo tracks
`package-lock.json` and no `pnpm-lock.yaml` exists. Fixes and additions:

1. ~~Replace the pnpm setup and install with `npm ci`~~ — **done**, per the binding rule in
   `CLAUDE.md`, along with removing the legacy `pnpm` block from `package.json` and moving
   Node from 20 to 24 to match the local Windows environment.
2. New job `web-build`: `npx expo export -p web` on every PR. **This job is the
   enforcement of the three-target contract** — it stops the web target rotting while
   Android work continues.
3. New job `deploy`, `main` only: `upload-pages-artifact` plus `deploy-pages`.
4. New job `release`, triggered on a pushed `v*` tag: runs the same export and attaches
   `bockzettel-offline.html` to the GitHub Release, so the offline download has a stable
   link. Deliberately **not** on every `main` push — the offline file is a versioned
   hand-out, not a rolling build.

## Tests

The project runs `testEnvironment: 'node'` with hand-written mocks in `__mocks__/`, 27
pure-logic suites totalling 196 tests, and no component rendering tests. This change stays
inside that style.

### Storage contract suite

`__tests__/data/localStorageContract.ts` exports a suite asserting the `LocalStorage`
contract; `jsonFileStorage.test.ts`, `idbStorage.test.ts` and `memoryStorage.test.ts` each
run it against their implementation. Cases: write-then-read-one, write-then-read-all,
overwrite, delete, delete of a missing key, `readOne` of a missing key, `readAll` of an
empty collection, isolation between collections, and a corrupt record being skipped rather
than throwing.

`fake-indexeddb/auto` supplies the IndexedDB globals and works in the node environment —
no jsdom needed for this suite.

### `__tests__/application/sheetHtml.test.ts`

New coverage for the ~200 lines extracted from `pdfShare.ts`, which have never been
tested: player columns, sitting-out cells, positive and negative score classes, the totals
row, bock rows, solo labelling, and HTML escaping of player names.

### Web DOM adapters

`fileShare.web.test.ts`, `pickImportFile.web.test.ts` and `pdfShare.web.test.ts` use
`jest-environment-jsdom` via a per-file docblock, matching how `fileShare.test.ts` already
tests the native side through mocks. The adapters stay deliberately thin so this stays
cheap.

### New devDependencies

`fake-indexeddb`, `jest-environment-jsdom`. **No new runtime dependencies.**

## Risks

| Risk | Assessment | Mitigation |
|---|---|---|
| Single-file size | Likely 3–4 MB | Measure first; subset the icon font if needed |
| `reactCompiler: true` (`app.json:52`) on react-native-web | Unverified combination | Verify early; the experiment can be disabled for the web target if it misbehaves |
| Reanimated / gesture-handler on web | **Low.** Neither appears anywhere in app code — both are transitive requirements of react-navigation and Paper, whose web paths work | `patches/` already exists if a patch becomes necessary |
| `blob:` URL lost on hard reload during import review | Cosmetic; native has the same hole | Accepted, documented above |
| Browser storage eviction | Real but unlikely for a few KB | `navigator.storage.persist()`; JSON export as the backstop |
| Icon fonts failing to load on `file://` | Possible under strict origin rules | The data URI avoids a network fetch entirely |

## Verification checklist

1. `npm ci`, then `npm run typecheck`, `npm run lint`, `npm test` all green.
2. `npm run web` — every screen reachable, a sheet can be created and games entered.
3. Reload the browser — data survives (IndexedDB path).
4. PDF export opens the browser print dialog with the correct sheet.
5. JSON export downloads; re-importing it round-trips through the review screen.
6. `npx expo export -p web` succeeds; `dist/` deployed to Pages loads over the subpath.
7. Offline: load the Pages URL, disable the network, reload — the app still starts.
8. Open `bockzettel-offline.html` from disk in Chrome and Firefox — the app runs, the
   banner states session-only, JSON import and export both work.
9. `npm run android` still builds and runs (the native target must not regress).
