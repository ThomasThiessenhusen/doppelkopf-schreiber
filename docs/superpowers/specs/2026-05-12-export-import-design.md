# Export / import (Spec 2a — unencrypted)

## Context

Spec 1 (player-pool-reference) is done. `GameSheet` now references the
app-wide pool by `playerIds`. Spec 2a adds export and import as JSON
files exchanged via the OS share sheet, so that two devices can swap
data without a cloud server. Encryption is deferred to Spec 2b; manual
two-pool-players-into-one merging is Spec 3.

## Goal

A user can export an individual sheet, an entire group with its sheets,
or a full backup as a JSON file via the OS share sheet, and import such
a file on another device through the OS document picker. On import, the
user sees a single review screen with bulk and per-row decisions for
every non-trivial player / group / sheet entry, applies the plan, and
ends with consistent local data.

## Out of scope

- Encryption / password-protection of exports (Spec 2b).
- Manual "merge two pool players into one" outside of the import flow
  (Spec 3).
- File-association / share-sheet receive integration on the import side
  (Document Picker covers v1).
- Cloud sync or device-to-device transport other than file exchange.

## File envelope

Every export, regardless of scope, uses the same top-level JSON shape:

```json
{
  "app": "doppelkopf_schreiber",
  "formatVersion": 1,
  "kind": "sheet" | "group" | "backup",
  "exportedAt": "2026-05-12T15:00:00.000Z",
  "exportedFromAppVersion": "0.1.0",
  "payload": {
    "players": [ /* pool snapshots — only those referenced by sheets in payload */ ],
    "sheets": [ /* 0..n full sheet records */ ],
    "groups": [ /* 0..n full group records */ ],
    "settings": null | { /* AppSettings, only when kind = "backup" */ }
  }
}
```

Per-`kind` constraints:

| `kind`  | sheets       | groups | players                       | settings |
|---------|--------------|--------|-------------------------------|----------|
| sheet   | exactly 1    | 0      | exactly those in the sheet    | null     |
| group   | 0..n         | 1      | union over sheets             | null     |
| backup  | all          | all    | full pool                     | object   |

Pool players in the payload are snapshots written at export time. They
are the source for the import-side pool decisions (`useLocal`,
`addAsNew`, `mergeInto`).

The parser MUST reject files with `app !== "doppelkopf_schreiber"` or
`formatVersion !== 1`. Unknown payload fields are silently ignored
(forward-compatible reads).

## Export flow

### UI entry points

- **Single sheet** — in [SheetScreen.tsx](src/presentation/screens/SheetScreen.tsx),
  add a `Bogen exportieren...` item to the three-dot menu.
- **Group** — in [GroupManagementScreen.tsx](src/presentation/screens/GroupManagementScreen.tsx),
  add `Gruppe exportieren...` to the per-group menu.
- **Full backup** — in [SettingsScreen.tsx](src/presentation/screens/SettingsScreen.tsx),
  add a `Backup exportieren` button.

Each entry point calls into the matching export-service method.

### `src/application/export/exportService.ts`

```ts
export interface ExportFile {
  readonly envelope: ExportEnvelope;
  readonly suggestedFilename: string;
}

export function exportSheet(sheetId: string): Promise<ExportFile>;
export function exportGroup(groupId: string): Promise<ExportFile>;
export function exportBackup(): Promise<ExportFile>;
```

- `exportSheet`: loads sheet via repo, loads its referenced players from
  the pool, builds `{kind: 'sheet', payload: {players, sheets:[sheet],
  groups:[], settings:null}}`.
- `exportGroup`: loads group + all sheets with `groupId === g.id` +
  union of referenced players.
- `exportBackup`: loads all sheets + all groups + full pool +
  `AppSettings`.

The envelope's `exportedFromAppVersion` is read from `app.json`'s
`expo.version`.

### `src/data/export/fileShare.ts`

```ts
export function shareExport(file: ExportFile): Promise<void>;
```

Writes the envelope as pretty-printed JSON to the app's
`cacheDirectory/exports/<suggestedFilename>` and invokes
`Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Bockzettel teilen' })`.
Cache files are not actively cleaned up; the OS reclaims the cache
directory when needed.

### Suggested filename

`bockzettel-<scope>-<YYYY-MM-DD>.json`, where `<scope>` is:

- `sheet`: the sheet's title or `bogen` if untitled
- `group`: the group's name
- `backup`: literal `backup`

Normalised: lowercase, NFD-strip accents, non-`[a-z0-9-]` → `-`,
collapse runs of `-`, trim leading/trailing `-`.

### Dependencies to add

- `expo-sharing` — official Expo module for the share-sheet call.
- `expo-document-picker` — official Expo module for the import side
  (used in the next section).

## Import flow

### UI entry point

`Import...` button in [SettingsScreen.tsx](src/presentation/screens/SettingsScreen.tsx).
Opens the OS document picker, filtered to `application/json`. On
selection, the parsed-and-diffed plan is rendered in a new screen.

### Phase 1 — parse and validate

`src/application/import/importParser.ts`:

```ts
export interface ParsedExportFile {
  readonly envelope: ExportEnvelope;  // typed payload
}

export class ParseError extends Error { /* readable message */ }

export function parseExportFile(rawText: string): ParsedExportFile;
```

Throws `ParseError` for:

- `JSON.parse` failure.
- `app !== 'doppelkopf_schreiber'`.
- `formatVersion !== 1`.
- `kind` not in `{sheet, group, backup}`.
- Per-`kind` invariants from the table above violated.

The payload contents are deserialised with the existing
`gameSheetFromJson`, `sheetGroupFromJson`, `playerFromJson`,
`appSettingsFromJson` helpers, all of which already do their own
strict-but-defensive parsing.

### Phase 2 — diff

`src/application/import/importDiff.ts`:

```ts
export type PlayerAction =
  | { kind: 'useLocal'; localId: string }                    // implicit when ids match
  | { kind: 'mergeInto'; localId: string }                   // remap importedId -> localId
  | { kind: 'addAsNew' }                                     // write pool entry with imported id
  | { kind: 'skip' };                                        // blocks dependent sheets

export interface PlayerDecision {
  readonly imported: Player;          // the snapshot from the file
  readonly suggested: PlayerAction;   // default action
  readonly choices: ReadonlyArray<PlayerAction>;  // alternatives the user can pick
}

export type SheetAction =
  | { kind: 'useLocal' }       // implicit when ids and updatedAt match
  | { kind: 'addAsNew' }       // no local id collision — write with imported id
  | { kind: 'replaceLocal' }   // local id exists — overwrite
  | { kind: 'keepLocal' }      // local id exists — ignore imported
  | { kind: 'addCopy' }        // local id exists — write imported under a fresh id
  | { kind: 'skip' };

export interface SheetDecision {
  readonly imported: GameSheet;
  readonly localExisting: GameSheet | null;
  readonly suggested: SheetAction;
}

// GroupDecision mirrors SheetDecision.

export type SettingsAction = 'replace' | 'keep';

export interface ImportPlan {
  readonly players: ReadonlyArray<PlayerDecision>;
  readonly groups: ReadonlyArray<GroupDecision>;
  readonly sheets: ReadonlyArray<SheetDecision>;
  readonly settings: { suggested: SettingsAction } | null;
}

export interface LocalState {
  readonly players: ReadonlyArray<Player>;
  readonly groups: ReadonlyArray<SheetGroup>;
  readonly sheets: ReadonlyArray<GameSheet>;
  readonly settings: AppSettings;
}

export function buildImportPlan(parsed: ParsedExportFile, local: LocalState): ImportPlan;
```

Player suggestion rules:

1. Imported id matches a local pool id → `useLocal { localId: matchedId }`.
2. Imported id is new, but `playerDisplayName(imported)` equals
   `playerDisplayName(local)` for some local player → suggest
   `mergeInto { localId: matchedLocalId }`. Always allow `addAsNew` as
   alternative.
3. Imported id is new, no name match → suggest `addAsNew`. Alternative
   is `mergeInto { localId: ... }` choosing any local player (the UI
   builds a dropdown).
4. `skip` is always allowed.

Sheet / group suggestion rules:

1. Local sheet/group with same id and same `updatedAt` → `useLocal`
   (not displayed in the UI).
2. Local sheet/group with same id, imported `updatedAt > local.updatedAt`
   → suggest `replaceLocal`. Alternatives: `keepLocal`, `addCopy`,
   `skip`.
3. Local sheet/group with same id, imported `updatedAt < local.updatedAt`
   → suggest `keepLocal`. Alternatives: `replaceLocal`, `addCopy`,
   `skip`.
4. No local sheet/group with this id → suggest `addAsNew` (imported id
   becomes the local id). Alternatives: `addCopy` (assign fresh id
   anyway), `skip`. `replaceLocal` / `keepLocal` are not offered here.

Settings (only for `kind === 'backup'`):

- Imported settings deep-equal local settings → suggested `keep` (and
  not displayed).
- Any field differs → suggested `replace`. Alternative is `keep`.
  (Settings have no third "copy" path — they're a singleton.)

`useLocal` decisions are not displayed in the UI — they're applied
silently.

### Phase 3 — UI and apply

`src/presentation/screens/ImportReviewScreen.tsx` renders three
collapsible sections (Spieler, Gruppen, Spielbögen) plus a Settings
section when applicable. Each row shows the imported entity and a
dropdown for the action; when `mergeInto` is selectable, a second
dropdown picks the target.

Above each section: bulk buttons (`Alle importierten nehmen`, `Alle
lokalen behalten`, `Alle überspringen`). Footer: `Abbrechen` /
`Übernehmen`.

`src/application/import/importApply.ts`:

```ts
export interface ImportResult {
  readonly playersAdded: number;
  readonly playersMerged: number;
  readonly groupsAdded: number;
  readonly groupsReplaced: number;
  readonly groupsCopied: number;     // addCopy
  readonly sheetsAdded: number;
  readonly sheetsReplaced: number;
  readonly sheetsCopied: number;
  readonly sheetsSkipped: number;
  readonly settingsReplaced: boolean;
}

export function applyImportPlan(plan: ImportPlan): Promise<ImportResult>;
```

Apply order:

1. Resolve player decisions into a `Map<importedId, localId>` remap:
   - `useLocal` → `imported.id → decision.localId`.
   - `mergeInto` → `imported.id → decision.localId`.
   - `addAsNew` → write the imported player to the pool unchanged; map
     `imported.id → imported.id`.
   - `skip` → no entry. Any sheet that referenced this id will already
     have been demoted to `skip` during plan construction (see
     "Skipping a player").
2. Apply settings decision (if any) — only `replace` writes; `keep` is
   a no-op.
3. Apply group decisions, recording a `Map<importedGroupId, localGroupId>`
   remap:
   - `useLocal` → no write; map `imported.id → imported.id` (ids
     match).
   - `addAsNew` → write with imported id; map `imported.id →
     imported.id`.
   - `replaceLocal` → write with imported id, overwriting; map
     `imported.id → imported.id`.
   - `keepLocal` → no-op; map `imported.id → imported.id` (so any
     sheet importing under this group still finds it locally).
   - `addCopy` → assign fresh id, write; map `imported.id → newId`.
   - `skip` → no map entry; sheets carrying this `groupId` lose the
     reference (set to `null`).
4. Apply sheet decisions, in this order per sheet:
   - Rewrite `playerIds` through the player-remap.
   - Rewrite `groupId` through the group-remap (or `null` if missing).
   - Apply the action with the same shape as groups
     (`useLocal`/`addAsNew`/`replaceLocal`/`keepLocal`/`addCopy`/`skip`).

### Skipping a player

If the user marks a player `skip`, any sheet that references that id is
demoted to `skip` automatically before the user submits. The UI shows
this as a disabled sheet row with explanation "abhängiger Spieler
übersprungen". This rule lives in `buildImportPlan` and is re-applied
whenever the user changes a player decision.

### Transactionality

`LocalStorage` has no atomic transaction. Apply writes sequentially,
order: players → settings → groups → sheets. If a write throws midway,
the partial result is left on disk and the user gets an error toast
with text like "Import nicht vollständig — bitte erneut versuchen".
After Spec 1's loadAll resilience, a partial state is recoverable: bad
or missing references render as placeholder players in the UI, no
crash.

## Tests

### `__tests__/application/exportService.test.ts`

- `exportSheet`: envelope has `kind=sheet`, payload.players contains
  exactly the referenced pool entries (not unrelated players).
- `exportGroup`: payload.sheets is exactly the sheets with matching
  `groupId`; payload.players is the union over them.
- `exportBackup`: payload contains all pool, all groups, all sheets,
  and settings.
- Suggested-filename normalisation: `Stammtisch Mai` → `stammtisch-mai`;
  `Müllers Geburtstag` → `muellers-geburtstag`; runs collapsed.

### `__tests__/application/importParser.test.ts`

- Happy round-trip for each `kind`.
- Wrong `app` → `ParseError`.
- Unknown `formatVersion` → `ParseError`.
- Unknown payload fields ignored (forward compatibility).
- Broken JSON → `ParseError` with readable message.

### `__tests__/application/importDiff.test.ts`

- Player same id → `useLocal` (not shown in plan's visible-list, but
  present in the data).
- Player different id, same name → suggested `mergeInto`.
- Player different id, no name match → suggested `addAsNew`.
- Player decision `skip` cascades into dependent sheets becoming
  `skip`.
- Sheet new id → suggested `addAsNew`.
- Sheet existing id, same updatedAt → `useLocal`.
- Sheet existing id, imported newer → `replaceLocal`.
- Sheet existing id, imported older → `keepLocal`.
- Group decisions mirror sheets.
- Settings backup: differing fields suggest `replace`.

### `__tests__/application/importApply.test.ts`

- `addAsNew` writes pool entry with imported id; map covers id→id.
- `mergeInto` remap: sheet referencing imported id now stores local id.
- `replaceLocal` overwrites; `keepLocal` is a no-op; `addCopy` assigns
  a new id; `skip` is a no-op.
- Settings `replace` overwrites.
- After apply: every `playerId` in any local sheet has a matching
  pool entry (referential integrity smoke check).

### `__tests__/integration/export-import-roundtrip.test.ts`

- Export the demo data → serialize → parse on a second in-memory
  storage (empty) → build plan → all decisions default → apply.
- Assert: second storage is byte-identical to the first (player ids,
  group ids, sheet ids, every persisted field).
- Variant: second storage already has a player with the same id →
  player decision is `useLocal`, local pool entry remains unchanged
  after apply.
