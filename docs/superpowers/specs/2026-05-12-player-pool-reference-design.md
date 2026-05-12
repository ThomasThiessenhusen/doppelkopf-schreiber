# Player pool reference (drop per-sheet snapshots)

## Context

The user plans to add export/import for app-to-app synchronisation
without a cloud server. Clean import semantics require that a
`GameSheet` references players by ID from a single source of truth.
Today, `GameSheet.players` holds inline `Player` snapshots, intentionally
decoupled from the app-wide pool so renaming or deleting a pool entry
doesn't change history. The user has accepted that the snapshot
property goes away: pool renames will retroactively change all sheets,
pool deletes are blocked while the player is referenced.

This spec covers the data-model refactor only. The export/import feature
and the manual "merge two pool players into one" feature are explicitly
out of scope and will get their own specs.

## Goal

`GameSheet` references players only via a list of pool IDs. The app-wide
player pool is the only source for player names. Existing data is
migrated transparently on first launch after the update.

## Invariants after change

1. For every `playerId` in `GameSheet.playerIds`, the player pool
   contains a `Player` with that `id`.
2. A pool player may not be deleted while any persisted `GameSheet`
   references their `id`. The UI surfaces this; the store enforces it.
3. Pool renames take immediate effect across all sheets — there is no
   per-sheet name copy left to keep stale.

## Domain model

### `src/domain/models/gameSheet.ts`

`GameSheet` shape:

```ts
export interface GameSheet {
  readonly id: string;
  readonly title: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly playerIds: ReadonlyArray<string>;
  readonly rounds: ReadonlyArray<Round>;
  readonly dirty: boolean;
  readonly stackingModeOverride: BockStackingMode | null;
  readonly groupId: string | null;
}
```

`CreateGameSheetInput.players: ReadonlyArray<Player>` stays — callers
keep passing full `Player` objects for ergonomic reasons. Internally
`createGameSheet`:

- validates length 4 or 5 as today,
- stores `playerIds: input.players.map(p => p.id)`,
- does **not** itself write to the pool. Pool maintenance is the
  caller's job (the application/store layer). Domain stays pure.

`copyGameSheet`'s `players` patch field is renamed to `playerIds:
ReadonlyArray<string>`. All other patch semantics stay.

`gameSheetToJson` writes a `playerIds: string[]` array. It no longer
writes a `players` array.

`gameSheetFromJson` reads `playerIds` if present (new form). If absent
but the legacy `players: [...]` array is present, it extracts the IDs
from each entry as a fallback so older files keep loading. This is
defensive; the migration below means it should almost never trigger
after first launch.

Helpers that read player data (`gamesPerRound`, `nextSittingOutPlayer`,
`playerCount`) operate on `playerIds.length` and `playerIds[i]`.
`nextSittingOutPlayer` returns a player **id**, not a `Player` object —
callers resolve the id to a name via the pool. The function's name
becomes `nextSittingOutPlayerId` to make the change explicit.
`nextSittingOutPlayer` has no consumers outside `gameSheet.ts` today,
so the rename is internal.

### `src/domain/models/player.ts`

No change to `Player`, `createPlayer`, `playerToJson`,
`playerFromJson`. The pool keeps its current shape.

### New helper: `src/domain/models/playerLookup.ts`

```ts
export interface PlayerLookup {
  byId(id: string): Player | null;
}

export function createPlayerLookup(
  pool: ReadonlyArray<Player>,
): PlayerLookup;

/**
 * Resolves a sheet's player ids to Player objects in stable order.
 * Missing ids yield a placeholder Player with `playerName: ''` so the
 * UI never crashes on a broken reference. Invariant violations are
 * logged once per session.
 */
export function resolveSheetPlayers(
  sheet: GameSheet,
  lookup: PlayerLookup,
): ReadonlyArray<Player>;
```

The placeholder uses the missing id as the `Player.id` so React keys
stay unique. `firstName` and `lastName` are `null`.

## Data migration

### When

Once, on app startup, before the UI mounts any sheet- or pool-aware
screen. Implementation: a new module `src/data/migrations/v2.ts`
exports `runV2Migration(storage: LocalStorage): Promise<void>`. The
root layout [app/_layout.tsx](app/_layout.tsx) gains a
`migrationReady` state alongside the existing `i18nReady` gate; the
`ActivityIndicator` fallback waits for both. A flag file at
`{documentDirectory}/doppelkopf_schreiber/meta/schema_v2.flag` marks
completion; if present, migration returns immediately.

### Steps

1. Check for the flag file. If present, return.
2. Read the pool via `LocalStorage.readAll('players')` (raw). Build a
   `Set` of pool ids from each raw entry's `id` field.
3. List all sheet entries via `LocalStorage.readAll('game_sheets')`
   (raw — do not go through `gameSheetFromJson` because we want
   access to the legacy `players` array even on already-readable
   sheets).
4. For each raw sheet json with a string `id`:
   - If it already has `playerIds`, skip.
   - Otherwise, take the legacy `players` array. For each snapshot
     with a string `id`:
     - If the id is in the pool set, do nothing.
     - Else `LocalStorage.write('players', snapshot.id, playerToJson(...))`
       and add the id to the set.
   - Replace `players` with `playerIds: [...ids]` in the json and
     `LocalStorage.write('game_sheets', sheet.id, json)`.
5. Write the flag file.

Migration is idempotent: a second run finds the flag and exits. A
crashed mid-migration restarts cleanly — every step is independently
safe because (a) pool writes are deduplicated by id and (b) sheet
rewrites only ever convert from old-form to new-form.

### Name collision policy during migration

If two snapshots in different sheets share a player name but have
different ids, both are imported into the pool as separate entries.
Migration does not merge by name. Consolidation is the user's job via
the upcoming manual-merge feature.

## Application layer

### `playerListStore.remove`

Today:

```ts
async remove(id) {
  await repositories.player().delete(id);
  set({ players: get().players.filter((p) => p.id !== id) });
}
```

New behaviour: before delete, check whether the id is referenced.

- Add `isPlayerReferenced(id: string): Promise<boolean>` to a new
  module `src/application/playerUsage.ts`. It iterates
  `gameSheetRepository.loadAll()` and returns `true` on the first
  match.
- `remove` calls `isPlayerReferenced(id)`. If `true`, throw a typed
  error `PlayerReferencedError` (new export from `playerUsage.ts`)
  that the UI catches.

### Sheet-creation path

`sheetListStore.createSheet` and any other path that constructs a
`GameSheet` from a list of `Player` objects must guarantee the pool
contains those ids before saving the sheet. New helper in
`playerUsage.ts`:

```ts
export async function ensurePoolMembership(
  players: ReadonlyArray<Player>,
): Promise<void>;
```

It calls `repositories.player().save(p)` for any player whose id is
not yet in the pool. The current sheet-creation flow always picks
players from the pool, so this should be a no-op today; the helper
exists as a safety net and as the seam the future import flow will
plug into.

## Presentation layer

Each consumer of `sheet.players` swaps to a pool-aware lookup.

- **`SheetScreen.tsx`** — does **not** currently subscribe to the
  player pool. Add `const pool = usePlayerListStore(s => s.players)`
  plus a `refresh` effect (matching the pattern used in
  `NewSheetScreen.tsx`). Build a `PlayerLookup` via `useMemo` from
  the pool. Pass `resolveSheetPlayers(sheet, lookup)` to downstream
  widgets (`Scoreboard`, `RoundSection`, `TeamPicker`,
  `AddGameScreen`). The resolved array is the same shape the widgets
  expect today, so the widgets themselves don't change.
- **`AddGameScreen.tsx`** — same subscription pattern; resolved
  players are passed to `TeamPicker`.
- **`HomeScreen.tsx`** — sheet list rows that show player names use
  the same pool subscription. If the home screen only shows player
  counts (no names), no change is needed.
- **`GroupRankingsScreen.tsx`** — same pattern: build the lookup from
  the player pool, pass it into `calculateGroupRankings`.
- **`groupRankingCalculator.ts`** — signature gains a
  `lookup: PlayerLookup` parameter and uses
  `resolveSheetPlayers(sheet, lookup)` internally. Existing tests
  update to construct a lookup from a test pool.
- **`NewSheetScreen.tsx`** — already picks from the pool; only change
  is that the call into `createSheet` continues to pass `Player[]`,
  and `sheetListStore.createSheet` now also calls
  `ensurePoolMembership(players)` before persisting. (Defensive no-op
  in practice.)
- **`PlayerManagementScreen.tsx`** —
  - On render, precompute a `Set` of referenced ids via
    `isPlayerReferenced`-batched-with-one-load. Easier: add
    `referencedIdsFromSheets(sheets): Set<string>` to
    `playerUsage.ts`, load all sheets once, derive the set.
  - The delete `IconButton` is disabled when the id is in the set;
    long-press / tooltip shows
    `t('players.errorDeleteReferenced')`.
  - If a delete still slips through (race), catch
    `PlayerReferencedError` from the store and show the same message
    via Snackbar.

## i18n keys

Add to both `de.ts` and `en.ts` under the `players` block:

- `errorDeleteReferenced`:
  `Spieler ist in mindestens einem Spielbogen eingetragen.` /
  `This player is used in at least one game sheet.`

`__tests__/presentation/i18n/localesShape.test.ts` enforces parity.

## Tests

### Migration — `__tests__/data/migration.playerPool.test.ts`

- Legacy sheet json with `players: [snapshot]` + empty pool →
  after migration: pool contains the snapshot, sheet json has
  `playerIds: [id]`, no `players` field.
- Legacy sheet json with two snapshots, pool already contains one of
  them → after migration: pool gains exactly the missing one,
  `playerIds` lists both ids in original order.
- Second migration run is a no-op (flag file present).
- Crash-recovery: deleting the flag file and re-running on
  already-migrated data leaves data identical (idempotency).
- Snapshots with same name but different ids → both end up in the
  pool as separate entries.

### Domain — `__tests__/domain/playerLookup.test.ts`

- `resolveSheetPlayers` preserves `playerIds` order.
- Missing id yields a placeholder with `playerName: ''` and the
  missing id as `Player.id`.
- `createPlayerLookup` returns the same `Player` instance for
  repeated `byId` calls (referential stability for React keys).

### Domain — `__tests__/domain/gameSheet.test.ts` (extend existing)

- `gameSheetToJson` writes `playerIds` and no `players` field.
- `gameSheetFromJson` reads `playerIds` form.
- `gameSheetFromJson` falls back to legacy `players` form and
  extracts the ids.

### Application — `__tests__/application/playerUsage.test.ts`

- `isPlayerReferenced(id)` true when any sheet has the id.
- `isPlayerReferenced(id)` false when no sheet does.
- `ensurePoolMembership` adds only missing players; existing ones
  untouched.
- `referencedIdsFromSheets` returns the union over all sheets.

### Store — `__tests__/application/playerListStore.test.ts` (extend)

- `remove(id)` rejects with `PlayerReferencedError` when referenced;
  player remains in the pool list.
- `remove(id)` succeeds when not referenced.

### Smoke — `__tests__/presentation/poolRename.smoke.test.ts`

- Create a sheet via the store, rename the player in the pool,
  render `Scoreboard` — title shows the new name.

## Out of scope

- Export/import of files between devices (separate spec).
- Manual merging of two pool players into one (separate spec).
- Active backfill of `nextSittingOutPlayer` callers to the new
  `nextSittingOutPlayerId` name beyond what the type system forces.
- Any UI for managing the schema version flag (debug-only file).
