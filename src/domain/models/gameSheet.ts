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
