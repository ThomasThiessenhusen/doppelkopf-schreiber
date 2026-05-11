import type { Game } from '@/domain/models/game';
import { gameFromJson, gameToJson } from '@/domain/models/game';

/**
 * Eine Runde besteht aus 4 (4 Spieler) bzw. 5 (5 Spieler) Spielen.
 *
 * Bei 5 Spielern setzt jeweils ein Spieler aus und ist Kartengeber. Die
 * Reihenfolge der aussetzenden Spieler ergibt sich aus der Spielerliste des
 * `GameSheet` und dem Index der Runde / des Spiels.
 */
export interface Round {
  readonly index: number;
  readonly games: ReadonlyArray<Game>;
}

export function withGame(round: Round, game: Game): Round {
  return { index: round.index, games: [...round.games, game] };
}

export function withGameAt(round: Round, gameIndex: number, game: Game): Round {
  const next = [...round.games];
  if (gameIndex >= next.length) {
    next.push(game);
  } else {
    next[gameIndex] = game;
  }
  return { index: round.index, games: next };
}

export function withoutGame(round: Round, gameId: string): Round {
  return {
    index: round.index,
    games: round.games.filter((g) => g.id !== gameId),
  };
}

export function roundToJson(round: Round): Record<string, unknown> {
  return {
    index: round.index,
    games: round.games.map((g) => gameToJson(g)),
  };
}

export function roundFromJson(json: Record<string, unknown>): Round {
  const index = json['index'];
  const games = json['games'];
  if (typeof index !== 'number') throw new Error('Round.index fehlt oder ist keine Zahl');
  if (!Array.isArray(games)) throw new Error('Round.games fehlt oder ist kein Array');
  return {
    index,
    games: games.map((g) => gameFromJson(g as Record<string, unknown>)),
  };
}
