import { newId } from '@/core/id';
import type { Game } from '@/domain/models/game';
import { playerFromJson, playerToJson, type Player } from '@/domain/models/player';
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
 * Enthaelt eine fixe Spielerliste (4 oder 5) und beliebig viele Runden. Die
 * Struktur ist immutable; Aenderungen werden ueber `copyGameSheet`,
 * `sheetWithGame`, `replaceGame`, `removeGame` erzeugt und vom Repository
 * persistiert.
 */
export interface GameSheet {
  readonly id: string;
  readonly title: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly players: ReadonlyArray<Player>;
  readonly rounds: ReadonlyArray<Round>;
  /** Nicht synchronisierte Aenderung — Marker fuer spaeteren Cloud-Sync. */
  readonly dirty: boolean;
  /** Override fuer den Bock-Stapel-Modus dieses Spielbogens. `null` = Global. */
  readonly stackingModeOverride: BockStackingMode | null;
  /** Optionale Zuordnung zu einer Gruppe (Saison/Turnier). `null` = ungruppiert. */
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
    players: input.players,
    rounds: [],
    dirty: true,
    stackingModeOverride: null,
    groupId: input.groupId ?? null,
  };
}

export function playerCount(sheet: GameSheet): number {
  return sheet.players.length;
}

/** Anzahl Spiele pro Runde — 5 bei 5 Spielern, sonst 4. */
export function gamesPerRound(sheet: GameSheet): number {
  return sheet.players.length === 5 ? 5 : 4;
}

/** Gesamtanzahl der bereits gespielten Spiele. */
export function totalGames(sheet: GameSheet): number {
  return sheet.rounds.reduce((sum, r) => sum + r.games.length, 0);
}

/** Iteriert durch alle Spiele in chronologischer Reihenfolge. */
export function* allGames(sheet: GameSheet): Generator<Game> {
  for (const r of sheet.rounds) {
    for (const g of r.games) {
      yield g;
    }
  }
}

/**
 * Liefert die laufende Runde — also die Runde, in der das naechste Spiel
 * einzutragen waere. Bei leerem Bogen oder abgeschlossener letzter Runde
 * wird eine neue, leere Runde zurueckgegeben.
 */
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
 * Berechnet, welcher Spieler bei 5 Spielern fuer das naechste Spiel
 * aussetzt (Kartengeber). Liefert `null` bei 4 Spielern.
 */
export function nextSittingOutPlayer(sheet: GameSheet): Player | null {
  if (sheet.players.length !== 5) return null;
  const round = currentOrNextRound(sheet);
  const gameIndex = round.games.length;
  const flatIndex = round.index * gamesPerRound(sheet) + gameIndex;
  return sheet.players[flatIndex % sheet.players.length] ?? null;
}

export interface GameSheetPatch {
  title?: string | null;
  players?: ReadonlyArray<Player>;
  rounds?: ReadonlyArray<Round>;
  /** Auslassen = `new Date()` (jetzt). */
  updatedAt?: Date;
  /** Auslassen = `true`. */
  dirty?: boolean;
  /** Auslassen = behalten; `null` = clearen; Wert = setzen. */
  stackingModeOverride?: BockStackingMode | null;
  /** Auslassen = behalten; `null` = clearen; String = setzen. */
  groupId?: string | null;
}

export function copyGameSheet(sheet: GameSheet, patch: GameSheetPatch): GameSheet {
  return {
    id: sheet.id,
    title: 'title' in patch ? (patch.title ?? null) : sheet.title,
    createdAt: sheet.createdAt,
    updatedAt: patch.updatedAt ?? new Date(),
    players: patch.players ?? sheet.players,
    rounds: patch.rounds ?? sheet.rounds,
    dirty: patch.dirty ?? true,
    stackingModeOverride:
      'stackingModeOverride' in patch
        ? (patch.stackingModeOverride ?? null)
        : sheet.stackingModeOverride,
    groupId: 'groupId' in patch ? (patch.groupId ?? null) : sheet.groupId,
  };
}

/**
 * Fuegt ein Spiel an die laufende Runde an und legt bei Bedarf eine neue
 * Runde an.
 */
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

/** Aktualisiert ein bestehendes Spiel anhand seiner ID. */
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

/**
 * Entfernt ein Spiel und nummeriert die Runden neu, damit die Anzeige nicht
 * „Runde 3" springen zeigt, wenn Runde 1 entfernt wurde.
 */
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
    players: sheet.players.map((p) => playerToJson(p)),
    rounds: sheet.rounds.map((r) => roundToJson(r)),
    dirty: sheet.dirty,
    stackingModeOverride:
      sheet.stackingModeOverride === null ? null : bockStackingModeToJson(sheet.stackingModeOverride),
    groupId: sheet.groupId,
  };
}

export function gameSheetFromJson(json: Record<string, unknown>): GameSheet {
  const id = json['id'];
  const createdAt = json['createdAt'];
  const updatedAt = json['updatedAt'];
  const players = json['players'];
  const rounds = json['rounds'];
  if (typeof id !== 'string') throw new Error('GameSheet.id fehlt');
  if (typeof createdAt !== 'string') throw new Error('GameSheet.createdAt fehlt');
  if (typeof updatedAt !== 'string') throw new Error('GameSheet.updatedAt fehlt');
  if (!Array.isArray(players)) throw new Error('GameSheet.players fehlt');
  if (!Array.isArray(rounds)) throw new Error('GameSheet.rounds fehlt');
  const rawStacking = json['stackingModeOverride'];
  return {
    id,
    title: typeof json['title'] === 'string' ? (json['title'] as string) : null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    players: players.map((p) => playerFromJson(p as Record<string, unknown>)),
    rounds: rounds.map((r) => roundFromJson(r as Record<string, unknown>)),
    dirty: json['dirty'] === true,
    stackingModeOverride:
      typeof rawStacking === 'string' ? bockStackingModeFromJson(rawStacking) : null,
    groupId: typeof json['groupId'] === 'string' ? (json['groupId'] as string) : null,
  };
}
