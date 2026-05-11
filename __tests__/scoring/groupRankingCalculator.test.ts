import { createGame, WinnerSide, type Game } from '@/domain/models/game';
import { type GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { Round } from '@/domain/models/round';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { calculateGroupRankings } from '@/domain/scoring/groupRankingCalculator';
import type { RankingEntry } from '@/domain/scoring/groupRankings';

const alice: Player = { id: 'a', firstName: 'Alice', lastName: null, nickname: null };
const bob: Player = { id: 'b', firstName: 'Bob', lastName: null, nickname: null };
const carol: Player = { id: 'c', firstName: 'Carol', lastName: null, nickname: null };
const dave: Player = { id: 'd', firstName: 'Dave', lastName: null, nickname: null };

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
    players: opts.players,
    rounds: opts.games.length === 0 ? [] : [round],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}

function classicReWin(reIds: string[], contraIds: string[]): Game {
  return createGame({
    rePlayerIds: reIds,
    contraPlayerIds: contraIds,
    winner: WinnerSide.re,
    flagCodes: [],
  });
}

function byPlayer(entries: ReadonlyArray<RankingEntry>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.playerId] = e.value;
  return out;
}

function ranksByPlayer(entries: ReadonlyArray<RankingEntry>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.playerId] = e.rank;
  return out;
}

describe('calculateGroupRankings', () => {
  test('Leere Gruppe -> leere Ranglisten', () => {
    const result = calculateGroupRankings({
      sheets: [],
      defaultMode: BockStackingMode.sequential,
    });
    expect(result.placementPoints).toEqual([]);
    expect(result.totalPoints).toEqual([]);
    expect(result.wonSoli).toEqual([]);
  });

  test('Drei Boegen mit drei Re-Siegen: Platzierungspunkte verteilen sich', () => {
    const s1 = sheetWith({
      id: 's1',
      players: [alice, bob, carol, dave],
      games: [classicReWin(['a', 'b'], ['c', 'd'])],
    });
    const s2 = sheetWith({
      id: 's2',
      players: [alice, bob, carol, dave],
      games: [classicReWin(['c', 'd'], ['a', 'b'])],
    });
    const s3 = sheetWith({
      id: 's3',
      players: [alice, bob, carol, dave],
      games: [classicReWin(['a', 'c'], ['b', 'd'])],
    });

    const result = calculateGroupRankings({
      sheets: [s1, s2, s3],
      defaultMode: BockStackingMode.sequential,
    });

    const placement = byPlayer(result.placementPoints);
    expect(placement['a']).toBe(10);
    expect(placement['b']).toBe(8);
    expect(placement['c']).toBe(10);
    expect(placement['d']).toBe(8);

    const points = byPlayer(result.totalPoints);
    expect(points['a']).toBe(1);
    expect(points['b']).toBe(-1);
    expect(points['c']).toBe(1);
    expect(points['d']).toBe(-1);
  });

  test('Geteilte Raenge: bei Gleichstand selber Rang in der Rangliste', () => {
    const s = sheetWith({
      id: 's',
      players: [alice, bob, carol, dave],
      games: [classicReWin(['a', 'b'], ['c', 'd'])],
    });

    const result = calculateGroupRankings({
      sheets: [s],
      defaultMode: BockStackingMode.sequential,
    });

    const ranks = ranksByPlayer(result.placementPoints);
    expect(ranks['a']).toBe(1);
    expect(ranks['b']).toBe(1);
    expect(ranks['c']).toBe(3);
    expect(ranks['d']).toBe(3);

    const values = byPlayer(result.placementPoints);
    expect(values['a']).toBe(4);
    expect(values['b']).toBe(4);
    expect(values['c']).toBe(2);
    expect(values['d']).toBe(2);
  });

  test('Spieler ohne Teilnahme erscheint nicht in der Rangliste', () => {
    const erna: Player = { id: 'e', firstName: 'Erna', lastName: null, nickname: null };
    const s = sheetWith({
      id: 's',
      players: [bob, carol, dave, erna],
      games: [classicReWin(['b', 'c'], ['d', 'e'])],
    });

    const result = calculateGroupRankings({
      sheets: [s],
      defaultMode: BockStackingMode.sequential,
    });

    const ids = new Set(result.totalPoints.map((e) => e.playerId));
    expect(ids.has('a')).toBe(false);
    expect(ids).toEqual(new Set(['b', 'c', 'd', 'e']));
  });

  test('Bogen ohne Spiele wird uebersprungen', () => {
    const s = sheetWith({
      id: 's',
      players: [alice, bob, carol, dave],
      games: [],
    });
    const result = calculateGroupRankings({
      sheets: [s],
      defaultMode: BockStackingMode.sequential,
    });
    expect(result.placementPoints).toEqual([]);
    expect(result.totalPoints).toEqual([]);
    expect(result.wonSoli).toEqual([]);
  });

  describe('Soli-Rangliste', () => {
    function solo(opts: {
      soloistId: string;
      contraIds: string[];
      winner: WinnerSide;
    }): Game {
      return createGame({
        rePlayerIds: [opts.soloistId],
        contraPlayerIds: opts.contraIds,
        winner: opts.winner,
        flagCodes: [],
        isSolo: true,
      });
    }

    test('Gewonnenes Solo zaehlt fuer den Solisten +1', () => {
      const s = sheetWith({
        id: 's',
        players: [alice, bob, carol, dave],
        games: [solo({ soloistId: 'a', contraIds: ['b', 'c', 'd'], winner: WinnerSide.re })],
      });
      const result = calculateGroupRankings({
        sheets: [s],
        defaultMode: BockStackingMode.sequential,
      });
      const soli = byPlayer(result.wonSoli);
      expect(soli['a']).toBe(1);
      expect(soli['b']).toBe(0);
      expect(soli['c']).toBe(0);
      expect(soli['d']).toBe(0);
    });

    test('Verlorenes Solo zaehlt nicht', () => {
      const s = sheetWith({
        id: 's',
        players: [alice, bob, carol, dave],
        games: [solo({ soloistId: 'a', contraIds: ['b', 'c', 'd'], winner: WinnerSide.contra })],
      });
      const result = calculateGroupRankings({
        sheets: [s],
        defaultMode: BockStackingMode.sequential,
      });
      const soli = byPlayer(result.wonSoli);
      expect(soli['a']).toBe(0);
      expect(soli['b']).toBe(0);
      expect(soli['c']).toBe(0);
      expect(soli['d']).toBe(0);
    });

    test('Soli aus mehreren Boegen werden korrekt aggregiert', () => {
      const s1 = sheetWith({
        id: 's1',
        players: [alice, bob, carol, dave],
        games: [
          solo({ soloistId: 'a', contraIds: ['b', 'c', 'd'], winner: WinnerSide.re }),
          classicReWin(['a', 'b'], ['c', 'd']),
          solo({ soloistId: 'b', contraIds: ['a', 'c', 'd'], winner: WinnerSide.re }),
        ],
      });
      const s2 = sheetWith({
        id: 's2',
        players: [alice, bob, carol, dave],
        games: [solo({ soloistId: 'a', contraIds: ['b', 'c', 'd'], winner: WinnerSide.re })],
      });
      const result = calculateGroupRankings({
        sheets: [s1, s2],
        defaultMode: BockStackingMode.sequential,
      });
      const soli = byPlayer(result.wonSoli);
      expect(soli['a']).toBe(2);
      expect(soli['b']).toBe(1);
      expect(soli['c']).toBe(0);
      expect(soli['d']).toBe(0);
    });
  });

  test('Spieler taucht erst spaeter auf: aggregiert nur ueber Boegen mit Teilnahme', () => {
    const s1 = sheetWith({
      id: 's1',
      players: [alice, bob, carol, dave],
      games: [classicReWin(['a', 'b'], ['c', 'd'])],
    });
    const erna: Player = { id: 'e', firstName: 'Erna', lastName: null, nickname: null };
    const s2 = sheetWith({
      id: 's2',
      players: [bob, carol, dave, erna],
      games: [classicReWin(['b', 'e'], ['c', 'd'])],
    });

    const result = calculateGroupRankings({
      sheets: [s1, s2],
      defaultMode: BockStackingMode.sequential,
    });

    const pts = byPlayer(result.totalPoints);
    expect(pts['a']).toBe(1);
    expect(pts['b']).toBe(2);
    expect(pts['c']).toBe(-2);
    expect(pts['d']).toBe(-2);
    expect(pts['e']).toBe(1);

    const placement = byPlayer(result.placementPoints);
    expect(placement['a']).toBe(4);
    expect(placement['b']).toBe(8);
    expect(placement['c']).toBe(4);
    expect(placement['d']).toBe(4);
    expect(placement['e']).toBe(4);
  });
});
