# Player Pool Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `GameSheet.players` inline snapshots with `GameSheet.playerIds` referencing the app-wide player pool, enforce referential integrity (no delete while referenced), and migrate existing on-disk data transparently on first launch.

**Architecture:** Eight commits, each leaving tests and `tsc --noEmit` green at the boundary where the consumers are touched. Order: (1) add the pure `playerLookup` domain helper; (2) refactor `GameSheet` model — typecheck for consumers goes red in this commit only; (3) repair every consumer (`SheetScreen`, `AddGameScreen`, `groupRankingCalculator`, `HomeScreen`, `sheetListStore.createSheet`) to use the lookup, closing the type loop; (4) add the v2 migration module; (5) wire migration into the root layout; (6) add `playerUsage` invariants module; (7) wire delete guard into store + Player screen + i18n; (8) add pool-rename smoke test.

**Tech Stack:** React Native + Expo, expo-file-system, react-native-paper, Zustand, i18next, Jest, TypeScript (strict).

**Reference spec:** [docs/superpowers/specs/2026-05-12-player-pool-reference-design.md](../specs/2026-05-12-player-pool-reference-design.md)

---

## File Map

- Create: `src/domain/models/playerLookup.ts` — pure `PlayerLookup` interface, `createPlayerLookup(pool)`, `resolveSheetPlayers(sheet, lookup)`.
- Modify: `src/domain/models/gameSheet.ts` — replace `players` field with `playerIds`; rename `nextSittingOutPlayer` → `nextSittingOutPlayerId`; JSON with legacy fallback.
- Modify: `__tests__/domain/gameSheet.test.ts` — adapt to new API and add legacy-JSON test.
- Create: `__tests__/domain/playerLookup.test.ts` — covers `createPlayerLookup`, `resolveSheetPlayers`, missing-id placeholder.
- Modify: `src/application/stores/sheetListStore.ts` — `createSheet` calls `ensurePoolMembership` before persisting.
- Modify: `src/domain/scoring/groupRankingCalculator.ts` — takes a `lookup: PlayerLookup` parameter.
- Modify: `__tests__/scoring/groupRankingCalculator.test.ts` — adapt to new sheet shape and lookup param.
- Modify: `src/presentation/screens/SheetScreen.tsx` — subscribe to pool, build lookup, pass resolved players downstream.
- Modify: `src/presentation/screens/AddGameScreen.tsx` — same; also fix local `nextSittingOutOfSheet` helper to use ids.
- Modify: `src/presentation/screens/HomeScreen.tsx` — `metaLine` uses `sheet.playerIds.length`.
- Modify: `src/presentation/screens/GroupRankingsScreen.tsx` — subscribe to pool, pass lookup to calculator.
- Create: `src/data/migrations/v2PoolReference.ts` — `runV2Migration(storage)` with idempotency flag.
- Create: `__tests__/data/v2PoolReference.test.ts` — migration coverage including idempotency and name-collision cases.
- Modify: `app/_layout.tsx` — `migrationReady` gate next to `i18nReady`.
- Create: `src/application/playerUsage.ts` — `isPlayerReferenced`, `ensurePoolMembership`, `referencedIdsFromSheets`, `PlayerReferencedError`.
- Create: `__tests__/application/playerUsage.test.ts` — covers all three helpers and the error class.
- Modify: `src/application/stores/playerListStore.ts` — `remove` rejects with `PlayerReferencedError` when referenced.
- Modify: `src/presentation/screens/PlayerManagementScreen.tsx` — referenced-set computed from sheets; delete button disabled with snackbar fallback on race.
- Modify: `src/presentation/i18n/locales/de.ts` — add `players.errorDeleteReferenced`.
- Modify: `src/presentation/i18n/locales/en.ts` — add `players.errorDeleteReferenced`.
- Create: `__tests__/presentation/poolRename.smoke.test.ts` — pool rename reflects in resolved sheet players.

---

## Task 1: `playerLookup` domain helper

**Files:**
- Create: `src/domain/models/playerLookup.ts`
- Create: `__tests__/domain/playerLookup.test.ts`

Pure, additive — no production code changes here, build stays green.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/domain/playerLookup.test.ts`. **Note:** in Task 1 the
current `GameSheet` interface still has a `players` field (not `playerIds`),
so the test must NOT annotate against `GameSheet`. It uses a minimal local
shape. After Task 2 lands, structural typing keeps the test compatible
without changes.

```ts
import {
  createPlayerLookup,
  resolveSheetPlayers,
} from '@/domain/models/playerLookup';
import type { Player } from '@/domain/models/player';

const anna: Player = { id: 'a', playerName: 'Anna', firstName: null, lastName: null };
const ben: Player = { id: 'b', playerName: 'Ben', firstName: null, lastName: null };

function sheetWith(playerIds: ReadonlyArray<string>) {
  return { playerIds };
}

describe('createPlayerLookup', () => {
  test('byId returns the same instance for repeated calls', () => {
    const lookup = createPlayerLookup([anna, ben]);
    expect(lookup.byId('a')).toBe(lookup.byId('a'));
  });
  test('unknown id returns null', () => {
    const lookup = createPlayerLookup([anna]);
    expect(lookup.byId('zz')).toBe(null);
  });
});

describe('resolveSheetPlayers', () => {
  test('preserves playerIds order', () => {
    const lookup = createPlayerLookup([ben, anna]);
    const sheet = sheetWith(['a', 'b']);
    const resolved = resolveSheetPlayers(sheet, lookup);
    expect(resolved.map((p) => p.playerName)).toEqual(['Anna', 'Ben']);
  });
  test('missing id yields placeholder with empty name and the id', () => {
    const lookup = createPlayerLookup([anna]);
    const sheet = sheetWith(['a', 'missing']);
    const resolved = resolveSheetPlayers(sheet, lookup);
    expect(resolved[1]).toEqual({
      id: 'missing',
      playerName: '',
      firstName: null,
      lastName: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- playerLookup`

Expected: FAIL with module-not-found for `@/domain/models/playerLookup`.

- [ ] **Step 3: Implement the module**

Create `src/domain/models/playerLookup.ts`. The function accepts a minimal
`SheetLike` shape instead of `GameSheet` so that this commit doesn't depend
on the upcoming Task 2 change. After Task 2 lands, callers pass `GameSheet`
and TypeScript widens through structural typing.

```ts
import type { Player } from '@/domain/models/player';

export interface PlayerLookup {
  byId(id: string): Player | null;
}

export function createPlayerLookup(pool: ReadonlyArray<Player>): PlayerLookup {
  const map = new Map<string, Player>();
  for (const p of pool) {
    map.set(p.id, p);
  }
  return {
    byId(id) {
      return map.get(id) ?? null;
    },
  };
}

interface SheetLike {
  readonly playerIds: ReadonlyArray<string>;
}

export function resolveSheetPlayers(
  sheet: SheetLike,
  lookup: PlayerLookup,
): ReadonlyArray<Player> {
  return sheet.playerIds.map((id) => {
    const p = lookup.byId(id);
    if (p !== null) return p;
    return { id, playerName: '', firstName: null, lastName: null };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- playerLookup`

Expected: PASS (3 assertions).

- [ ] **Step 5: Verify typecheck**

Run: `pnpm typecheck`

Expected: no new errors introduced by this commit.

- [ ] **Step 6: Commit**

```bash
git add src/domain/models/playerLookup.ts __tests__/domain/playerLookup.test.ts
git commit -m "feat(domain): add PlayerLookup and resolveSheetPlayers helpers"
```

---

## Task 2: Refactor `GameSheet` model to `playerIds`

**Files:**
- Modify: `src/domain/models/gameSheet.ts`
- Modify: `__tests__/domain/gameSheet.test.ts`

This commit changes the `GameSheet` interface. Every consumer file that reads `sheet.players` will fail to type-check — that is **expected and resolved in Task 3**. Tests for `gameSheet.ts` itself stay green at the end of this commit.

- [ ] **Step 1: Rewrite `gameSheet.ts` interface and helpers**

Edit `src/domain/models/gameSheet.ts`. Replace the `players` field, `CreateGameSheetInput`, all helpers, JSON read/write, and rename `nextSittingOutPlayer` → `nextSittingOutPlayerId`.

```ts
import { newId } from '@/core/id';
import type { Game } from '@/domain/models/game';
import type { Player } from '@/domain/models/player';
import {
  roundFromJson,
  roundToJson,
  type Round,
  withGame as roundWithGame,
} from '@/domain/models/round';
import {
  type BockStackingMode,
  bockStackingModeFromJson,
  bockStackingModeToJson,
} from '@/domain/scoring/bockStackingMode';

/**
 * Ein Spielbogen — die Top-Level-Datenstruktur.
 *
 * Enthaelt eine fixe Liste von Spieler-IDs (4 oder 5) und beliebig viele Runden.
 * Die Spielerdaten liegen ausschliesslich im app-weiten Pool; der Bogen
 * referenziert sie ueber `playerIds`.
 */
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

export interface CreateGameSheetInput {
  players: ReadonlyArray<Player>;
  title?: string | null;
  at?: Date;
  groupId?: string | null;
}

export function createGameSheet(input: CreateGameSheetInput): GameSheet {
  if (input.players.length !== 4 && input.players.length !== 5) {
    throw new Error('Doppelkopf wird mit 4 oder 5 Spielern gespielt.');
  }
  const now = input.at ?? new Date();
  const trimmedTitle = input.title?.trim();
  return {
    id: newId(),
    title: trimmedTitle === undefined || trimmedTitle === '' ? null : trimmedTitle,
    createdAt: now,
    updatedAt: now,
    playerIds: input.players.map((p) => p.id),
    rounds: [],
    dirty: true,
    stackingModeOverride: null,
    groupId: input.groupId ?? null,
  };
}

export function playerCount(sheet: GameSheet): number {
  return sheet.playerIds.length;
}

export function gamesPerRound(sheet: GameSheet): number {
  return sheet.playerIds.length === 5 ? 5 : 4;
}

export function totalGames(sheet: GameSheet): number {
  return sheet.rounds.reduce((sum, r) => sum + r.games.length, 0);
}

export function* allGames(sheet: GameSheet): Generator<Game> {
  for (const r of sheet.rounds) {
    for (const g of r.games) {
      yield g;
    }
  }
}

export function currentOrNextRound(sheet: GameSheet): Round {
  if (sheet.rounds.length === 0) {
    return { index: 0, games: [] };
  }
  const last = sheet.rounds[sheet.rounds.length - 1]!;
  if (last.games.length >= gamesPerRound(sheet)) {
    return { index: last.index + 1, games: [] };
  }
  return last;
}

/**
 * Liefert die ID des Spielers, der bei 5 Spielern fuer das naechste Spiel
 * aussetzt. Liefert `null` bei 4 Spielern. Aufrufer aufloesen die ID via
 * Pool-Lookup zu einem Player-Objekt.
 */
export function nextSittingOutPlayerId(sheet: GameSheet): string | null {
  if (sheet.playerIds.length !== 5) return null;
  const round = currentOrNextRound(sheet);
  const gameIndex = round.games.length;
  const flatIndex = round.index * gamesPerRound(sheet) + gameIndex;
  return sheet.playerIds[flatIndex % sheet.playerIds.length] ?? null;
}

export interface GameSheetPatch {
  title?: string | null;
  playerIds?: ReadonlyArray<string>;
  rounds?: ReadonlyArray<Round>;
  updatedAt?: Date;
  dirty?: boolean;
  stackingModeOverride?: BockStackingMode | null;
  groupId?: string | null;
}

export function copyGameSheet(sheet: GameSheet, patch: GameSheetPatch): GameSheet {
  return {
    id: sheet.id,
    title: 'title' in patch ? (patch.title ?? null) : sheet.title,
    createdAt: sheet.createdAt,
    updatedAt: patch.updatedAt ?? new Date(),
    playerIds: patch.playerIds ?? sheet.playerIds,
    rounds: patch.rounds ?? sheet.rounds,
    dirty: patch.dirty ?? true,
    stackingModeOverride:
      'stackingModeOverride' in patch
        ? (patch.stackingModeOverride ?? null)
        : sheet.stackingModeOverride,
    groupId: 'groupId' in patch ? (patch.groupId ?? null) : sheet.groupId,
  };
}

export function sheetWithGame(sheet: GameSheet, game: Game): GameSheet {
  const round = currentOrNextRound(sheet);
  const updatedRound = roundWithGame(round, game);
  const lastIndex = sheet.rounds.length - 1;
  const last = lastIndex >= 0 ? sheet.rounds[lastIndex] : undefined;
  let nextRounds: ReadonlyArray<Round>;
  if (last === undefined || last.index !== updatedRound.index) {
    nextRounds = [...sheet.rounds, updatedRound];
  } else {
    nextRounds = [...sheet.rounds.slice(0, lastIndex), updatedRound];
  }
  return copyGameSheet(sheet, { rounds: nextRounds });
}

export function replaceGame(sheet: GameSheet, updated: Game): GameSheet {
  const nextRounds = sheet.rounds.map((r) => {
    if (r.games.some((g) => g.id === updated.id)) {
      return {
        index: r.index,
        games: r.games.map((g) => (g.id === updated.id ? updated : g)),
      };
    }
    return r;
  });
  return copyGameSheet(sheet, { rounds: nextRounds });
}

export function removeGame(sheet: GameSheet, gameId: string): GameSheet {
  const filtered = sheet.rounds
    .map((r) => ({ index: r.index, games: r.games.filter((g) => g.id !== gameId) }))
    .filter((r) => r.games.length > 0);
  const renumbered: ReadonlyArray<Round> = filtered.map((r, i) => ({
    index: i,
    games: r.games,
  }));
  return copyGameSheet(sheet, { rounds: renumbered });
}

export function gameSheetToJson(sheet: GameSheet): Record<string, unknown> {
  return {
    id: sheet.id,
    title: sheet.title,
    createdAt: sheet.createdAt.toISOString(),
    updatedAt: sheet.updatedAt.toISOString(),
    playerIds: [...sheet.playerIds],
    rounds: sheet.rounds.map((r) => roundToJson(r)),
    dirty: sheet.dirty,
    stackingModeOverride:
      sheet.stackingModeOverride === null ? null : bockStackingModeToJson(sheet.stackingModeOverride),
    groupId: sheet.groupId,
  };
}

/**
 * Liest die aktuelle Form (`playerIds`). Defensives Lesen fuer alte Daten:
 * wenn `playerIds` fehlt aber das legacy `players`-Array vorhanden ist,
 * werden die IDs daraus extrahiert. Die App-Migration (v2PoolReference)
 * konvertiert solche Dateien beim ersten Start; dieser Fallback hier ist
 * der zweite Verteidigungsring.
 */
export function gameSheetFromJson(json: Record<string, unknown>): GameSheet {
  const id = json['id'];
  const createdAt = json['createdAt'];
  const updatedAt = json['updatedAt'];
  const rounds = json['rounds'];
  if (typeof id !== 'string') throw new Error('GameSheet.id fehlt');
  if (typeof createdAt !== 'string') throw new Error('GameSheet.createdAt fehlt');
  if (typeof updatedAt !== 'string') throw new Error('GameSheet.updatedAt fehlt');
  if (!Array.isArray(rounds)) throw new Error('GameSheet.rounds fehlt');

  const playerIds = readPlayerIds(json);
  const rawStacking = json['stackingModeOverride'];
  return {
    id,
    title: typeof json['title'] === 'string' ? (json['title'] as string) : null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    playerIds,
    rounds: rounds.map((r) => roundFromJson(r as Record<string, unknown>)),
    dirty: json['dirty'] === true,
    stackingModeOverride:
      typeof rawStacking === 'string' ? bockStackingModeFromJson(rawStacking) : null,
    groupId: typeof json['groupId'] === 'string' ? (json['groupId'] as string) : null,
  };
}

function readPlayerIds(json: Record<string, unknown>): ReadonlyArray<string> {
  const ids = json['playerIds'];
  if (Array.isArray(ids)) {
    return ids.filter((v): v is string => typeof v === 'string');
  }
  const legacy = json['players'];
  if (Array.isArray(legacy)) {
    return legacy
      .map((p) => (p !== null && typeof p === 'object' ? (p as Record<string, unknown>)['id'] : null))
      .filter((v): v is string => typeof v === 'string');
  }
  throw new Error('GameSheet.playerIds fehlt');
}
```

Note: `Player` import is now only used in `CreateGameSheetInput`. Keep it.

- [ ] **Step 2: Rewrite `__tests__/domain/gameSheet.test.ts`**

Replace the file. Tests now use `playerIds` instead of `sheet.players` and assert against `nextSittingOutPlayerId`. Add new tests for JSON round-trip and legacy fallback.

```ts
import { createGame, WinnerSide } from '@/domain/models/game';
import {
  copyGameSheet,
  createGameSheet,
  gameSheetFromJson,
  gameSheetToJson,
  gamesPerRound,
  nextSittingOutPlayerId,
  playerCount,
  removeGame,
  replaceGame,
  sheetWithGame,
  totalGames,
} from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';

const players5: ReadonlyArray<Player> = [
  { id: 'a', playerName: 'Anna', firstName: null, lastName: null },
  { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
  { id: 'c', playerName: 'Carla', firstName: null, lastName: null },
  { id: 'd', playerName: 'Dirk', firstName: null, lastName: null },
  { id: 'e', playerName: 'Eva', firstName: null, lastName: null },
];

const players4: ReadonlyArray<Player> = players5.slice(0, 4);

describe('GameSheet', () => {
  test('createGameSheet stores only ids', () => {
    const sheet = createGameSheet({ players: players5 });
    expect(sheet.playerIds).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(playerCount(sheet)).toBe(5);
    expect(gamesPerRound(sheet)).toBe(5);
  });

  test('5 Spieler: Aussetzer-ID rotiert der Reihe nach', () => {
    let sheet = createGameSheet({ players: players5 });
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = nextSittingOutPlayerId(sheet);
      if (id === null) throw new Error('Erwartet Aussetzer bei 5 Spielern');
      out.push(id);
      sheet = sheetWithGame(
        sheet,
        createGame({
          rePlayerIds: sheet.playerIds.filter((p) => p !== id).slice(0, 2),
          contraPlayerIds: sheet.playerIds.filter((p) => p !== id).slice(2),
          sittingOutPlayerId: id,
          winner: WinnerSide.re,
          flagCodes: [],
        }),
      );
    }
    expect(out).toEqual(['a', 'b', 'c', 'd', 'e', 'a', 'b', 'c', 'd', 'e']);
  });

  test('4 Spieler: kein Aussetzer', () => {
    const sheet = createGameSheet({ players: players4 });
    expect(nextSittingOutPlayerId(sheet)).toBeNull();
    expect(gamesPerRound(sheet)).toBe(4);
  });

  test('totalGames zaehlt ueber Runden', () => {
    let sheet = createGameSheet({ players: players4 });
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a', 'b'],
        contraPlayerIds: ['c', 'd'],
        winner: WinnerSide.re,
        flagCodes: [],
      }),
    );
    expect(totalGames(sheet)).toBe(1);
  });

  test('replaceGame ersetzt anhand der id', () => {
    let sheet = createGameSheet({ players: players4 });
    const g = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: WinnerSide.re,
      flagCodes: [],
    });
    sheet = sheetWithGame(sheet, g);
    const updated = { ...g, winner: WinnerSide.contra };
    sheet = replaceGame(sheet, updated);
    expect([...sheet.rounds[0]!.games][0]!.winner).toBe(WinnerSide.contra);
  });

  test('removeGame nummeriert Runden neu', () => {
    let sheet = createGameSheet({ players: players4 });
    const g = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: WinnerSide.re,
      flagCodes: [],
    });
    sheet = sheetWithGame(sheet, g);
    sheet = removeGame(sheet, g.id);
    expect(sheet.rounds).toEqual([]);
  });

  test('copyGameSheet stackingModeOverride: clear vs keep vs set', () => {
    let sheet = createGameSheet({ players: players4 });
    sheet = copyGameSheet(sheet, { stackingModeOverride: BockStackingMode.doppelbock });
    expect(sheet.stackingModeOverride).toBe(BockStackingMode.doppelbock);
    sheet = copyGameSheet(sheet, {});
    expect(sheet.stackingModeOverride).toBe(BockStackingMode.doppelbock);
    sheet = copyGameSheet(sheet, { stackingModeOverride: null });
    expect(sheet.stackingModeOverride).toBe(null);
  });
});

describe('gameSheet JSON', () => {
  test('Round-Trip: schreibt playerIds, kein players-Array', () => {
    const sheet = createGameSheet({ players: players4 });
    const json = gameSheetToJson(sheet);
    expect(json['playerIds']).toEqual(['a', 'b', 'c', 'd']);
    expect(json['players']).toBeUndefined();
    const back = gameSheetFromJson(json);
    expect(back.playerIds).toEqual(['a', 'b', 'c', 'd']);
  });

  test('Fallback: liest legacy `players`-Snapshots und extrahiert IDs', () => {
    const legacy: Record<string, unknown> = {
      id: 'sheet-legacy',
      title: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      players: [
        { id: 'a', playerName: 'Anna', firstName: null, lastName: null },
        { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
        { id: 'c', playerName: 'Carla', firstName: null, lastName: null },
        { id: 'd', playerName: 'Dirk', firstName: null, lastName: null },
      ],
      rounds: [],
      dirty: false,
      stackingModeOverride: null,
      groupId: null,
    };
    const sheet = gameSheetFromJson(legacy);
    expect(sheet.playerIds).toEqual(['a', 'b', 'c', 'd']);
  });

  test('Fehler: weder playerIds noch players vorhanden', () => {
    const broken: Record<string, unknown> = {
      id: 's',
      title: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      rounds: [],
    };
    expect(() => gameSheetFromJson(broken)).toThrow(/playerIds/);
  });
});
```

- [ ] **Step 3: Verify domain tests pass**

Run: `pnpm test -- gameSheet`

Expected: PASS. All assertions green.

- [ ] **Step 4: Acknowledge typecheck is red**

Run: `pnpm typecheck`

Expected: FAIL with errors in `SheetScreen.tsx`, `AddGameScreen.tsx`, `HomeScreen.tsx`, `GroupRankingsScreen.tsx`, `groupRankingCalculator.ts`, plus their tests. **This is expected; Task 3 closes the loop.**

- [ ] **Step 5: Commit**

```bash
git add src/domain/models/gameSheet.ts __tests__/domain/gameSheet.test.ts
git commit -m "refactor(gameSheet): replace inline players with playerIds"
```

---

## Task 3: Repair consumers of `sheet.players`

**Files:**
- Modify: `src/presentation/screens/SheetScreen.tsx`
- Modify: `src/presentation/screens/AddGameScreen.tsx`
- Modify: `src/presentation/screens/HomeScreen.tsx`
- Modify: `src/presentation/screens/GroupRankingsScreen.tsx`
- Modify: `src/domain/scoring/groupRankingCalculator.ts`
- Modify: `__tests__/scoring/groupRankingCalculator.test.ts`
- Modify: `src/application/stores/sheetListStore.ts` (only: drop the now-stale doc comment about `dirty`; no behaviour change here)

This commit closes the type loop opened by Task 2. After this commit, `tsc --noEmit` is green again.

- [ ] **Step 1: Update `groupRankingCalculator.ts`**

Edit `src/domain/scoring/groupRankingCalculator.ts`:

Imports:

```ts
import { WinnerSide } from '@/domain/models/game';
import { allGames, totalGames, type GameSheet } from '@/domain/models/gameSheet';
import { playerDisplayName } from '@/domain/models/player';
import type { PlayerLookup } from '@/domain/models/playerLookup';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { effectiveStackingMode } from '@/domain/scoring/bockResolver';
import {
  groupRankingsEmpty,
  type GroupRankings,
  type RankingEntry,
} from '@/domain/scoring/groupRankings';
import { totalsFor } from '@/domain/scoring/scoreCalculator';
```

Signature & implementation:

```ts
export interface CalculateGroupRankingsInput {
  sheets: ReadonlyArray<GameSheet>;
  defaultMode: BockStackingMode;
  lookup: PlayerLookup;
}

export function calculateGroupRankings(input: CalculateGroupRankingsInput): GroupRankings {
  const { sheets, defaultMode, lookup } = input;
  if (sheets.length === 0) return groupRankingsEmpty;

  const placement = new Map<string, number>();
  const points = new Map<string, number>();
  const wonSoli = new Map<string, number>();
  const names = new Map<string, string>();

  for (const sheet of sheets) {
    if (totalGames(sheet) === 0) continue;

    const mode = effectiveStackingMode(sheet, defaultMode);
    const totals = totalsFor(sheet, mode);

    // Display-Namen aus dem Pool ueber den Lookup.
    for (const playerId of sheet.playerIds) {
      if (!names.has(playerId)) {
        const player = lookup.byId(playerId);
        names.set(playerId, player !== null ? playerDisplayName(player) : playerId);
      }
    }

    const activeIds = new Set<string>();
    for (const game of allGames(sheet)) {
      for (const id of game.rePlayerIds) activeIds.add(id);
      for (const id of game.contraPlayerIds) activeIds.add(id);
    }
    if (activeIds.size === 0) continue;

    const candidates = new Map<string, number>();
    for (const id of activeIds) {
      const value = totals.totalsByPlayerId.get(id) ?? 0;
      candidates.set(id, value);
      points.set(id, (points.get(id) ?? 0) + value);
      if (!wonSoli.has(id)) wonSoli.set(id, 0);
    }

    for (const game of allGames(sheet)) {
      if (game.isSolo && game.winner === WinnerSide.re && game.rePlayerIds.length > 0) {
        const soloistId = game.rePlayerIds[0]!;
        wonSoli.set(soloistId, (wonSoli.get(soloistId) ?? 0) + 1);
      }
    }

    const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]);
    const n = sorted.length;
    let rank = 0;
    let lastValue: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const [id, value] = sorted[i]!;
      if (value !== lastValue) {
        rank = i + 1;
        lastValue = value;
      }
      const pts = n - rank + 1;
      placement.set(id, (placement.get(id) ?? 0) + pts);
    }
  }

  return {
    placementPoints: toRanked(placement, names),
    totalPoints: toRanked(points, names),
    wonSoli: toRanked(wonSoli, names),
  };
}
```

Leave `toRanked` unchanged.

- [ ] **Step 2: Update `__tests__/scoring/groupRankingCalculator.test.ts`**

Change `sheetWith` to build sheets with `playerIds` and update every `calculateGroupRankings` call to pass a `lookup`:

```ts
import { createGame, WinnerSide, type Game } from '@/domain/models/game';
import { type GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { createPlayerLookup } from '@/domain/models/playerLookup';
import type { Round } from '@/domain/models/round';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { calculateGroupRankings } from '@/domain/scoring/groupRankingCalculator';

const alice: Player = { id: 'a', playerName: 'Alice', firstName: null, lastName: null };
const bob: Player = { id: 'b', playerName: 'Bob', firstName: null, lastName: null };
const carol: Player = { id: 'c', playerName: 'Carol', firstName: null, lastName: null };
const dave: Player = { id: 'd', playerName: 'Dave', firstName: null, lastName: null };

const lookup = createPlayerLookup([alice, bob, carol, dave]);

function sheetWith(opts: {
  id: string;
  players: ReadonlyArray<Player>;
  games: ReadonlyArray<Game>;
}): GameSheet {
  const now = new Date('2026-05-01T00:00:00.000Z');
  const round: Round = { index: 0, games: opts.games };
  return {
    id: opts.id,
    title: null,
    createdAt: now,
    updatedAt: now,
    playerIds: opts.players.map((p) => p.id),
    rounds: opts.games.length === 0 ? [] : [round],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}
```

Every existing call to `calculateGroupRankings({ sheets, defaultMode })` becomes
`calculateGroupRankings({ sheets, defaultMode, lookup })`. Leave the test body
otherwise alone (the assertions on `displayName` / `value` / `rank` still hold).

- [ ] **Step 3: Update `SheetScreen.tsx`**

Edit `src/presentation/screens/SheetScreen.tsx`. Add pool subscription and lookup; pass resolved players to `Scoreboard` and `RoundSection`.

Add at top:

```ts
import { usePlayerListStore } from '@/application/stores/playerListStore';
import {
  createPlayerLookup,
  resolveSheetPlayers,
} from '@/domain/models/playerLookup';
```

Inside `SheetScreen`:

```ts
const pool = usePlayerListStore((s) => s.players);
const refreshPool = usePlayerListStore((s) => s.refresh);

useEffect(() => {
  void refreshPool();
}, [refreshPool]);
```

Inside the `Loaded`/render section (wherever the sheet is in scope), build the
players array:

```ts
const lookup = useMemo(() => createPlayerLookup(pool), [pool]);
const players = useMemo(
  () => resolveSheetPlayers(state.value, lookup),
  [state.value, lookup],
);
```

Replace `sheet.players` with `players` and `sheet.players.length` with
`sheet.playerIds.length` at the read sites. `Scoreboard` and `RoundSection`
already accept `ReadonlyArray<Player>` — no signature change needed.

- [ ] **Step 4: Update `AddGameScreen.tsx`**

Edit `src/presentation/screens/AddGameScreen.tsx`.

Replace the file-local helper `nextSittingOutOfSheet` to operate on ids:

```ts
function nextSittingOutOfSheet(sheet: GameSheet): string | null {
  if (sheet.playerIds.length !== 5) return null;
  let totalGames = 0;
  for (const r of sheet.rounds) totalGames += r.games.length;
  const idx = totalGames % sheet.playerIds.length;
  return sheet.playerIds[idx] ?? null;
}
```

(Returns id, not Player.)

Inside the `Loaded` body, subscribe to the pool and resolve players:

```ts
const pool = usePlayerListStore((s) => s.players);
const refreshPool = usePlayerListStore((s) => s.refresh);
useEffect(() => {
  void refreshPool();
}, [refreshPool]);

const lookup = useMemo(() => createPlayerLookup(pool), [pool]);
const players = useMemo(() => resolveSheetPlayers(sheet, lookup), [sheet, lookup]);
```

Change `sittingOut` state to hold an id, then resolve when needed:

```ts
const [sittingOutId, setSittingOutId] = useState<string | null>(() => {
  if (existing !== null) {
    return existing.sittingOutPlayerId;
  }
  return nextSittingOutOfSheet(sheet);
});

const sittingOut = useMemo(() => {
  if (sittingOutId === null) return null;
  return lookup.byId(sittingOutId);
}, [sittingOutId, lookup]);
```

Replace every `sheet.players` read with `players`. Update the call site that
previously did `setSittingOut(player)` to `setSittingOutId(player.id)`. Update
`TeamPicker`'s `onSittingOutChanged` prop binding accordingly:

```tsx
<TeamPicker
  players={players}
  sittingOutPlayerId={sittingOutId}
  selectedRePlayerIds={rePlayerIds}
  onChanged={setRePlayerIds}
  onSittingOutChanged={(p) => setSittingOutId(p.id)}
/>
```

Add imports:

```ts
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { createPlayerLookup, resolveSheetPlayers } from '@/domain/models/playerLookup';
```

- [ ] **Step 5: Update `HomeScreen.tsx`**

Edit `src/presentation/screens/HomeScreen.tsx`. The metaLine reads
`sheet.players.length`. Change to `sheet.playerIds.length`:

```ts
const metaLine = t('home.metaLine', {
  playerCount: sheet.playerIds.length,
  gameCount: totalGamesOf(sheet),
  time: formatDateTime(sheet.updatedAt),
});
```

No pool subscription needed — HomeScreen displays counts, not names.

- [ ] **Step 6: Update `GroupRankingsScreen.tsx`**

Edit `src/presentation/screens/GroupRankingsScreen.tsx`. Subscribe to the pool
and pass a lookup to `calculateGroupRankings`:

```ts
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { createPlayerLookup } from '@/domain/models/playerLookup';
```

Inside the component:

```ts
const pool = usePlayerListStore((s) => s.players);
const refreshPool = usePlayerListStore((s) => s.refresh);

useEffect(() => {
  void refreshGroups();
  void refreshSheets();
  void loadSettings();
  void refreshPool();
}, [refreshGroups, refreshSheets, loadSettings, refreshPool]);
```

In the `rankings` useMemo:

```ts
const rankings = useMemo(() => {
  const inGroup = sheets.filter((s) => s.groupId === groupId);
  const lookup = createPlayerLookup(pool);
  return calculateGroupRankings({
    sheets: inGroup,
    defaultMode: settings.defaultStackingMode,
    lookup,
  });
}, [sheets, groupId, settings.defaultStackingMode, pool]);
```

- [ ] **Step 7: Verify typecheck and tests**

Run: `pnpm typecheck`

Expected: PASS, no errors.

Run: `pnpm test`

Expected: all suites green (gameSheet, playerLookup, groupRankingCalculator,
existing player tests).

- [ ] **Step 8: Commit**

```bash
git add src/presentation/screens/SheetScreen.tsx \
        src/presentation/screens/AddGameScreen.tsx \
        src/presentation/screens/HomeScreen.tsx \
        src/presentation/screens/GroupRankingsScreen.tsx \
        src/domain/scoring/groupRankingCalculator.ts \
        __tests__/scoring/groupRankingCalculator.test.ts
git commit -m "refactor: resolve sheet players via pool lookup"
```

---

## Task 4: v2 migration module

**Files:**
- Create: `src/data/migrations/v2PoolReference.ts`
- Create: `__tests__/data/v2PoolReference.test.ts`

The migration converts on-disk legacy sheets (with inline `players` arrays) to
the new form (with `playerIds`) and ensures the pool contains every snapshot
player.

**Note on the idempotency marker:** the spec talks about a flag file at
`meta/schema_v2.flag`. The plan instead stores the marker as a row in a
dedicated collection (`_migration/schema_v2`) so the migration works against
the existing `LocalStorage` interface and the in-memory test double without
introducing direct `expo-file-system` calls. Functionally equivalent.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/data/v2PoolReference.test.ts`:

```ts
import { runV2Migration } from '@/data/migrations/v2PoolReference';
import { createInMemoryStorage } from '@/data/local/__tests__-helpers'; // see step 2
import type { LocalStorage } from '@/data/local/localStorage';

function legacySheet(id: string, players: ReadonlyArray<{ id: string; playerName: string }>) {
  return {
    id,
    title: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    players: players.map((p) => ({ ...p, firstName: null, lastName: null })),
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}

describe('runV2Migration', () => {
  test('converts legacy sheet, adds missing pool entries, sets flag', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a', playerName: 'Anna' },
      { id: 'b', playerName: 'Ben' },
    ]));

    await runV2Migration(storage);

    const sheet = await storage.readOne('game_sheets', 's1');
    expect(sheet).toMatchObject({ playerIds: ['a', 'b'] });
    expect(sheet).not.toHaveProperty('players');

    const anna = await storage.readOne('players', 'a');
    expect(anna).toMatchObject({ id: 'a', playerName: 'Anna' });

    const flag = await storage.readOne('_migration', 'schema_v2');
    expect(flag).not.toBeNull();
  });

  test('keeps existing pool entries; only fills the missing ones', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('players', 'a', { id: 'a', playerName: 'AnnaPool' });
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a', playerName: 'AnnaSnapshot' },
      { id: 'b', playerName: 'Ben' },
    ]));

    await runV2Migration(storage);

    const annaAfter = await storage.readOne('players', 'a');
    expect(annaAfter).toMatchObject({ playerName: 'AnnaPool' });
    const benAfter = await storage.readOne('players', 'b');
    expect(benAfter).toMatchObject({ playerName: 'Ben' });
  });

  test('is idempotent', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a', playerName: 'Anna' },
    ]));
    await runV2Migration(storage);
    const first = await storage.readOne('game_sheets', 's1');

    await runV2Migration(storage);
    const second = await storage.readOne('game_sheets', 's1');

    expect(second).toEqual(first);
  });

  test('different ids with same name end up as two pool entries', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a1', playerName: 'Anna' },
    ]));
    await storage.write('game_sheets', 's2', legacySheet('s2', [
      { id: 'a2', playerName: 'Anna' },
    ]));

    await runV2Migration(storage);

    const all = await storage.readAll('players');
    expect(all).toHaveLength(2);
    expect(all.map((p) => p['id']).sort()).toEqual(['a1', 'a2']);
  });

  test('already-migrated sheet (playerIds present) is left alone', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', {
      id: 's1',
      title: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      playerIds: ['a'],
      rounds: [],
      dirty: false,
      stackingModeOverride: null,
      groupId: null,
    });

    await runV2Migration(storage);

    const after = await storage.readOne('game_sheets', 's1');
    expect(after).toMatchObject({ playerIds: ['a'] });
  });
});
```

- [ ] **Step 2: Expose `createInMemoryStorage` for production-side tests**

The current `createInMemoryStorage` lives at `__tests__/data/_inMemoryStorage.ts`.
The migration test sits in the same root, so import it directly via a relative
path instead of inventing a new helper module:

Change the test import line at the top of `__tests__/data/v2PoolReference.test.ts`:

```ts
import { createInMemoryStorage } from './_inMemoryStorage';
```

Remove the placeholder import `@/data/local/__tests__-helpers` (it doesn't
exist). The other imports stay.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test -- v2PoolReference`

Expected: FAIL with module-not-found for `@/data/migrations/v2PoolReference`.

- [ ] **Step 4: Implement `v2PoolReference.ts`**

Create `src/data/migrations/v2PoolReference.ts`:

```ts
import type { LocalStorage } from '@/data/local/localStorage';

const FLAG_COLLECTION = '_migration';
const FLAG_ID = 'schema_v2';

const SHEETS = 'game_sheets';
const PLAYERS = 'players';

/**
 * Konvertiert Spielboegen mit eingebetteten `players`-Snapshots in die neue
 * `playerIds`-Form und stellt sicher, dass jeder Snapshot im Pool existiert.
 * Idempotent durch ein Flag in einer eigenen Collection (`_migration/schema_v2`).
 */
export async function runV2Migration(storage: LocalStorage): Promise<void> {
  const existingFlag = await storage.readOne(FLAG_COLLECTION, FLAG_ID);
  if (existingFlag !== null) return;

  const pool = await storage.readAll(PLAYERS);
  const poolIds = new Set<string>();
  for (const entry of pool) {
    const id = entry['id'];
    if (typeof id === 'string') poolIds.add(id);
  }

  const sheets = await storage.readAll(SHEETS);
  for (const raw of sheets) {
    const sheetId = raw['id'];
    if (typeof sheetId !== 'string') continue;
    if (Array.isArray(raw['playerIds'])) continue;

    const legacy = raw['players'];
    if (!Array.isArray(legacy)) continue;

    const ids: string[] = [];
    for (const entry of legacy) {
      if (entry === null || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const pid = obj['id'];
      if (typeof pid !== 'string') continue;
      ids.push(pid);
      if (!poolIds.has(pid)) {
        await storage.write(PLAYERS, pid, sanitisePlayer(obj));
        poolIds.add(pid);
      }
    }

    const next: Record<string, unknown> = { ...raw, playerIds: ids };
    delete next['players'];
    await storage.write(SHEETS, sheetId, next);
  }

  await storage.write(FLAG_COLLECTION, FLAG_ID, {
    id: FLAG_ID,
    completedAt: new Date().toISOString(),
  });
}

function sanitisePlayer(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { id: raw['id'] };
  if (typeof raw['playerName'] === 'string') out['playerName'] = raw['playerName'];
  else if (typeof raw['nickname'] === 'string') out['playerName'] = raw['nickname'];
  else out['playerName'] = '';
  if (typeof raw['firstName'] === 'string') out['firstName'] = raw['firstName'];
  if (typeof raw['lastName'] === 'string') out['lastName'] = raw['lastName'];
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test -- v2PoolReference`

Expected: PASS (5 tests).

- [ ] **Step 6: Verify typecheck and other tests**

Run: `pnpm typecheck && pnpm test`

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/data/migrations/v2PoolReference.ts __tests__/data/v2PoolReference.test.ts
git commit -m "feat(data): add v2 migration that converts player snapshots to ids"
```

---

## Task 5: Wire migration into root layout

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `src/application/stores/repositories.ts` — expose the raw storage for migration

The bootstrap runs the migration once before any UI mounts. We add a
`migrationReady` flag alongside the existing `i18nReady` gate.

- [ ] **Step 1: Expose the storage instance from `repositories.ts`**

Edit `src/application/stores/repositories.ts`. Export the existing `storage`
binding via the `repositories` object:

```ts
import type { LocalStorage } from '@/data/local/localStorage';
import { createJsonFileStorage } from '@/data/local/jsonFileStorage';
// ...existing repo imports

const storage = createJsonFileStorage();

let _gameSheet = createLocalGameSheetRepository(storage);
let _player = createLocalPlayerRepository(storage);
let _settings = createLocalSettingsRepository(storage);
let _sheetGroup = createLocalSheetGroupRepository(storage);
let _storage: LocalStorage = storage;

export const repositories = {
  gameSheet: (): GameSheetRepository => _gameSheet,
  player: (): PlayerRepository => _player,
  settings: (): SettingsRepository => _settings,
  sheetGroup: (): SheetGroupRepository => _sheetGroup,
  storage: (): LocalStorage => _storage,
};

export function _overrideRepositoriesForTest(
  overrides: Partial<{
    gameSheet: GameSheetRepository;
    player: PlayerRepository;
    settings: SettingsRepository;
    sheetGroup: SheetGroupRepository;
    storage: LocalStorage;
  }>,
): void {
  if (overrides.gameSheet) _gameSheet = overrides.gameSheet;
  if (overrides.player) _player = overrides.player;
  if (overrides.settings) _settings = overrides.settings;
  if (overrides.sheetGroup) _sheetGroup = overrides.sheetGroup;
  if (overrides.storage) _storage = overrides.storage;
}
```

- [ ] **Step 2: Wire migration into `_layout.tsx`**

Edit `app/_layout.tsx`. Add the migration gate:

```tsx
import { runV2Migration } from '@/data/migrations/v2PoolReference';
import { repositories } from '@/application/stores/repositories';
```

Inside `RootLayout`:

```tsx
const [migrationReady, setMigrationReady] = useState(false);

useEffect(() => {
  let cancelled = false;
  void runV2Migration(repositories.storage()).then(() => {
    if (!cancelled) setMigrationReady(true);
  });
  return () => {
    cancelled = true;
  };
}, []);
```

Change the gate:

```tsx
if (!i18nReady || !migrationReady) {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm typecheck && pnpm test`

Expected: green. (Run-time can't be unit-tested for this wiring; manual
verification happens at the end.)

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx src/application/stores/repositories.ts
git commit -m "feat(bootstrap): run v2 pool-reference migration before UI mounts"
```

---

## Task 6: `playerUsage` invariants module

**Files:**
- Create: `src/application/playerUsage.ts`
- Create: `__tests__/application/playerUsage.test.ts`

This module is the seam for the delete-guard, the create-sheet hook, and the
future import flow.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/application/playerUsage.test.ts`:

```ts
import {
  ensurePoolMembership,
  isPlayerReferenced,
  PlayerReferencedError,
  referencedIdsFromSheets,
} from '@/application/playerUsage';
import {
  _overrideRepositoriesForTest,
  repositories,
} from '@/application/stores/repositories';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createInMemoryStorage } from '../data/_inMemoryStorage';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';

function sheet(id: string, playerIds: ReadonlyArray<string>): GameSheet {
  const now = new Date('2026-05-12T00:00:00.000Z');
  return {
    id,
    title: null,
    createdAt: now,
    updatedAt: now,
    playerIds,
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}

beforeEach(() => {
  const storage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage,
    player: createLocalPlayerRepository(storage),
    gameSheet: createLocalGameSheetRepository(storage),
  });
});

describe('isPlayerReferenced', () => {
  test('true when at least one sheet contains the id', async () => {
    await repositories.gameSheet().save(sheet('s1', ['a', 'b']));
    expect(await isPlayerReferenced('a')).toBe(true);
  });
  test('false when no sheet contains the id', async () => {
    await repositories.gameSheet().save(sheet('s1', ['a']));
    expect(await isPlayerReferenced('z')).toBe(false);
  });
});

describe('referencedIdsFromSheets', () => {
  test('returns union over sheets', async () => {
    await repositories.gameSheet().save(sheet('s1', ['a', 'b']));
    await repositories.gameSheet().save(sheet('s2', ['b', 'c']));
    const sheets = await repositories.gameSheet().loadAll();
    expect(referencedIdsFromSheets(sheets)).toEqual(new Set(['a', 'b', 'c']));
  });
});

describe('ensurePoolMembership', () => {
  test('adds only missing players', async () => {
    const existing: Player = {
      id: 'a',
      playerName: 'AnnaPool',
      firstName: null,
      lastName: null,
    };
    await repositories.player().save(existing);

    const candidates: ReadonlyArray<Player> = [
      { id: 'a', playerName: 'IgnoredName', firstName: null, lastName: null },
      { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
    ];
    await ensurePoolMembership(candidates);

    const pool = await repositories.player().loadAll();
    const ids = pool.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b']);
    const anna = pool.find((p) => p.id === 'a');
    expect(anna?.playerName).toBe('AnnaPool');
  });
});

describe('PlayerReferencedError', () => {
  test('carries the playerId', () => {
    const err = new PlayerReferencedError('a');
    expect(err).toBeInstanceOf(Error);
    expect(err.playerId).toBe('a');
    expect(err.name).toBe('PlayerReferencedError');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- playerUsage`

Expected: FAIL with module-not-found for `@/application/playerUsage`.

- [ ] **Step 3: Implement `playerUsage.ts`**

Create `src/application/playerUsage.ts`:

```ts
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { repositories } from '@/application/stores/repositories';

export class PlayerReferencedError extends Error {
  readonly playerId: string;
  constructor(playerId: string) {
    super(`Player ${playerId} is referenced by at least one sheet.`);
    this.name = 'PlayerReferencedError';
    this.playerId = playerId;
  }
}

export async function isPlayerReferenced(playerId: string): Promise<boolean> {
  const sheets = await repositories.gameSheet().loadAll();
  return sheets.some((s) => s.playerIds.includes(playerId));
}

export function referencedIdsFromSheets(
  sheets: ReadonlyArray<GameSheet>,
): Set<string> {
  const out = new Set<string>();
  for (const sheet of sheets) {
    for (const id of sheet.playerIds) out.add(id);
  }
  return out;
}

export async function ensurePoolMembership(
  players: ReadonlyArray<Player>,
): Promise<void> {
  const existing = await repositories.player().loadAll();
  const have = new Set(existing.map((p) => p.id));
  for (const p of players) {
    if (!have.has(p.id)) {
      await repositories.player().save(p);
      have.add(p.id);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- playerUsage`

Expected: PASS (5 tests).

- [ ] **Step 5: Verify typecheck and full test suite**

Run: `pnpm typecheck && pnpm test`

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/application/playerUsage.ts __tests__/application/playerUsage.test.ts
git commit -m "feat(application): add playerUsage invariants module"
```

---

## Task 7: Delete guard in store, UI, and i18n

**Files:**
- Modify: `src/application/stores/playerListStore.ts`
- Modify: `src/application/stores/sheetListStore.ts`
- Modify: `src/presentation/screens/PlayerManagementScreen.tsx`
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`
- Modify: `__tests__/application/playerUsage.test.ts` — extend with store-level scenarios (alternatively a new file)

- [ ] **Step 1: Add i18n key in `de.ts`**

Edit `src/presentation/i18n/locales/de.ts`. Inside the `players` block, add:

```ts
errorDeleteReferenced: 'Spieler ist in mindestens einem Spielbogen eingetragen.',
```

- [ ] **Step 2: Add i18n key in `en.ts`**

Edit `src/presentation/i18n/locales/en.ts`. Inside the `players` block, add:

```ts
errorDeleteReferenced: 'This player is used in at least one game sheet.',
```

- [ ] **Step 3: Verify locale shape test still passes**

Run: `pnpm test -- localesShape`

Expected: PASS — parity preserved.

- [ ] **Step 4: Update `playerListStore.remove`**

Edit `src/application/stores/playerListStore.ts`. Replace the body of `remove`:

```ts
import { isPlayerReferenced, PlayerReferencedError } from '@/application/playerUsage';

// ...

async remove(id) {
  if (await isPlayerReferenced(id)) {
    throw new PlayerReferencedError(id);
  }
  await repositories.player().delete(id);
  set({ players: get().players.filter((p) => p.id !== id) });
},
```

- [ ] **Step 5: Wire `ensurePoolMembership` into `sheetListStore.createSheet`**

Edit `src/application/stores/sheetListStore.ts`. Today `createSheet` takes a
fully-built `GameSheet`. With the model change, the sheet only has ids, so
the caller (`NewSheetScreen`) must also pass the `Player` objects it picked.
Extend the signature:

```ts
import type { Player } from '@/domain/models/player';
import { ensurePoolMembership } from '@/application/playerUsage';

export interface SheetListState {
  // ...existing
  createSheet: (
    sheet: GameSheet,
    players: ReadonlyArray<Player>,
  ) => Promise<GameSheet>;
  // ...
}

// in the store body:
async createSheet(sheet, players) {
  await ensurePoolMembership(players);
  await repositories.gameSheet().save(sheet);
  set({ sheets: [sheet, ...get().sheets] });
  return sheet;
},
```

Then update the **one** caller in
[src/presentation/screens/NewSheetScreen.tsx](src/presentation/screens/NewSheetScreen.tsx).
The relevant function is `async function create()` around line 149. Today it
calls `await createSheet(sheet)`; the local `Player[]` array of selected
players is in scope as `selected`. Change the call to:

```ts
await createSheet(sheet, selected);
```

No other changes in this file.

- [ ] **Step 6: Update `PlayerManagementScreen.tsx`**

Edit `src/presentation/screens/PlayerManagementScreen.tsx`. Add:

```ts
import { repositories } from '@/application/stores/repositories';
import {
  PlayerReferencedError,
  referencedIdsFromSheets,
} from '@/application/playerUsage';
import { Snackbar } from 'react-native-paper';
```

Inside `PlayerManagementScreen`, after the existing hooks:

```ts
const [referencedIds, setReferencedIds] = useState<ReadonlySet<string>>(
  () => new Set(),
);
const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  void repositories
    .gameSheet()
    .loadAll()
    .then((sheets) => {
      if (!cancelled) setReferencedIds(referencedIdsFromSheets(sheets));
    });
  return () => {
    cancelled = true;
  };
}, [players]);
```

Disable the delete `IconButton` for referenced ids. In the player list
`renderItem` (or wherever the delete button lives), pass
`disabled={referencedIds.has(player.id)}` and also wrap the existing
`onPress={() => remove(player.id)}` with the error catch:

```tsx
onPress={async () => {
  try {
    await remove(player.id);
  } catch (e) {
    if (e instanceof PlayerReferencedError) {
      setSnackbarMessage(t('players.errorDeleteReferenced'));
      setReferencedIds((prev) => new Set(prev).add(e.playerId));
    } else {
      throw e;
    }
  }
}}
```

At the end of the rendered tree (just before the closing fragment), add:

```tsx
<Snackbar
  visible={snackbarMessage !== null}
  onDismiss={() => setSnackbarMessage(null)}
  duration={3000}
>
  {snackbarMessage ?? ''}
</Snackbar>
```

- [ ] **Step 7: Extend `__tests__/application/playerUsage.test.ts` with a store-guard test**

Append to the file:

```ts
import { usePlayerListStore } from '@/application/stores/playerListStore';

describe('playerListStore.remove guard', () => {
  test('throws PlayerReferencedError when player is in a sheet', async () => {
    await repositories.player().save({
      id: 'a',
      playerName: 'Anna',
      firstName: null,
      lastName: null,
    });
    await repositories.gameSheet().save(sheet('s1', ['a']));
    await usePlayerListStore.getState().refresh();

    await expect(usePlayerListStore.getState().remove('a')).rejects.toThrow(
      PlayerReferencedError,
    );
    const players = await repositories.player().loadAll();
    expect(players.map((p) => p.id)).toEqual(['a']);
  });

  test('removes when not referenced', async () => {
    await repositories.player().save({
      id: 'a',
      playerName: 'Anna',
      firstName: null,
      lastName: null,
    });
    await usePlayerListStore.getState().refresh();

    await usePlayerListStore.getState().remove('a');
    const players = await repositories.player().loadAll();
    expect(players).toEqual([]);
  });
});
```

- [ ] **Step 8: Verify**

Run: `pnpm typecheck && pnpm test`

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/application/stores/playerListStore.ts \
        src/application/stores/sheetListStore.ts \
        src/presentation/screens/PlayerManagementScreen.tsx \
        src/presentation/screens/NewSheetScreen.tsx \
        src/presentation/i18n/locales/de.ts \
        src/presentation/i18n/locales/en.ts \
        __tests__/application/playerUsage.test.ts
git commit -m "feat(player): block delete and add pool membership on create"
```

---

## Task 8: Pool rename smoke test

**Files:**
- Create: `__tests__/presentation/poolRename.smoke.test.ts`

The smoke test proves that renaming a pool player surfaces in the resolved
players a sheet exposes, without going through the React renderer (so the test
stays fast and free of native-mock plumbing).

- [ ] **Step 1: Write the test**

Create `__tests__/presentation/poolRename.smoke.test.ts`:

```ts
import { _overrideRepositoriesForTest, repositories } from '@/application/stores/repositories';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createGameSheet } from '@/domain/models/gameSheet';
import {
  createPlayerLookup,
  resolveSheetPlayers,
} from '@/domain/models/playerLookup';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { createInMemoryStorage } from '../data/_inMemoryStorage';

beforeEach(() => {
  const storage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage,
    player: createLocalPlayerRepository(storage),
    gameSheet: createLocalGameSheetRepository(storage),
  });
});

test('renaming a pool player surfaces in resolved sheet players', async () => {
  await repositories.player().save({
    id: 'a',
    playerName: 'Anna',
    firstName: null,
    lastName: null,
  });
  await repositories.player().save({
    id: 'b',
    playerName: 'Ben',
    firstName: null,
    lastName: null,
  });
  await repositories.player().save({
    id: 'c',
    playerName: 'Carla',
    firstName: null,
    lastName: null,
  });
  await repositories.player().save({
    id: 'd',
    playerName: 'Dirk',
    firstName: null,
    lastName: null,
  });
  await usePlayerListStore.getState().refresh();

  const sheet = createGameSheet({
    players: [
      { id: 'a', playerName: 'Anna', firstName: null, lastName: null },
      { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
      { id: 'c', playerName: 'Carla', firstName: null, lastName: null },
      { id: 'd', playerName: 'Dirk', firstName: null, lastName: null },
    ],
  });
  await repositories.gameSheet().save(sheet);

  await usePlayerListStore.getState().update({
    id: 'a',
    playerName: 'Anna-Renamed',
    firstName: null,
    lastName: null,
  });

  const pool = usePlayerListStore.getState().players;
  const lookup = createPlayerLookup(pool);
  const resolved = resolveSheetPlayers(sheet, lookup);
  expect(resolved.map((p) => p.playerName)).toEqual([
    'Anna-Renamed',
    'Ben',
    'Carla',
    'Dirk',
  ]);
});
```

- [ ] **Step 2: Verify the test passes**

Run: `pnpm test -- poolRename`

Expected: PASS.

- [ ] **Step 3: Run the full suite + typecheck**

Run: `pnpm typecheck && pnpm test && pnpm lint`

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add __tests__/presentation/poolRename.smoke.test.ts
git commit -m "test(smoke): pool rename reflects in resolved sheet players"
```

---

## Final manual verification

Before declaring the plan done:

- [ ] **Manual: install, type-check, lint, test**

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

All four green.

- [ ] **Manual: real-device smoke**

Run the app on Android emulator or device with previously-stored sheet data
(if available). Expected on first launch: brief activity indicator, then
all existing sheets load with the same player names. Open a sheet → names
shown. Open Player Management → previously-snapshotted players are now in
the pool. Rename one → reopen sheet → name updates. Attempt to delete a
referenced player → button disabled.
