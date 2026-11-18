import { createGame, WinnerSide, type Game } from '@/domain/models/game';
import { type GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { createPlayerLookup } from '@/domain/models/playerLookup';
import type { Round } from '@/domain/models/round';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { calculateGroupRankings } from '@/domain/scoring/groupRankingCalculator';
import type { RankingEntry } from '@/domain/scoring/groupRankings';
import type { Substitution } from '@/domain/models/substitution';

const alice: Player = { id: 'a', playerName: 'Alice', firstName: null, lastName: null };
const bob: Player = { id: 'b', playerName: 'Bob', firstName: null, lastName: null };
const carol: Player = { id: 'c', playerName: 'Carol', firstName: null, lastName: null };
const dave: Player = { id: 'd', playerName: 'Dave', firstName: null, lastName: null };

const erik: Player = { id: 'e', playerName: 'Erik', firstName: null, lastName: null };
const xaver: Player = { id: 'x', playerName: 'Xaver', firstName: null, lastName: null };

const lookup = createPlayerLookup([alice, bob, carol, dave, erik, xaver]);

function sheetWith(opts: {
  id: string;
  players: readonly Player[];
  games: readonly Game[];
  substitutions?: readonly Substitution[];
}): GameSheet {
  const now = new Date('2026-05-01T00:00:00.000Z');
  const round: Round = { index: 0, games: opts.games };
  return {
    id: opts.id,
    title: null,
    createdAt: now,
    playedAt: now,
    updatedAt: now,
    playerIds: opts.players.map((p) => p.id),
    rounds: opts.games.length === 0 ? [] : [round],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
    substitutions: opts.substitutions ?? [],
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

function byPlayer(entries: readonly RankingEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.playerId] = e.value;
  return out;
}

function ranksByPlayer(entries: readonly RankingEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.playerId] = e.rank;
  return out;
}

describe('calculateGroupRankings', () => {
  test('Leere Gruppe -> leere Ranglisten', () => {
    const result = calculateGroupRankings({
      sheets: [],
      defaultMode: BockStackingMode.sequential,
      lookup,
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
      lookup,
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
      lookup,
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
    const erna: Player = { id: 'e', playerName: 'Erna', firstName: null, lastName: null };
    const s = sheetWith({
      id: 's',
      players: [bob, carol, dave, erna],
      games: [classicReWin(['b', 'c'], ['d', 'e'])],
    });

    const result = calculateGroupRankings({
      sheets: [s],
      defaultMode: BockStackingMode.sequential,
      lookup,
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
      lookup,
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
        lookup,
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
        lookup,
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
        lookup,
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
    const erna: Player = { id: 'e', playerName: 'Erna', firstName: null, lastName: null };
    const s2 = sheetWith({
      id: 's2',
      players: [bob, carol, dave, erna],
      games: [classicReWin(['b', 'e'], ['c', 'd'])],
    });

    const result = calculateGroupRankings({
      sheets: [s1, s2],
      defaultMode: BockStackingMode.sequential,
      lookup,
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

describe('calculateGroupRankings mit Vertretungen', () => {
  const dForE: Substitution = { substituteId: 'd', mainPlayerId: 'e' };
  const base = (subs: readonly Substitution[], id = 's1'): GameSheet =>
    sheetWith({
      id,
      players: [alice, bob, carol, dave],
      games: [classicReWin(['a', 'b'], ['c', 'd'])],
      substitutions: subs,
    });
  const calc = (sheets: readonly GameSheet[], applySubstitutions: boolean) =>
    calculateGroupRankings({
      sheets,
      defaultMode: BockStackingMode.sequential,
      lookup,
      applySubstitutions,
    });

  test('Vertretung aus: Ergebnis identisch zu ohne substitutions', () => {
    expect(byPlayer(calc([base([dForE])], false).placementPoints)).toEqual({
      a: 4,
      b: 4,
      c: 2,
      d: 2,
    });
  });

  test('Vertretung an: Stammspieler bekommt Punkte des Gastes zusaetzlich', () => {
    const r = calc([base([dForE])], true);
    expect(byPlayer(r.placementPoints)).toEqual({ a: 4, b: 4, c: 2, d: 2, e: 2 });
    expect(r.placementPoints.find((e) => e.playerId === 'e')?.displayName).toBe('Erik');
  });

  test('Vertretung an: Spielpunkte und Soli unveraendert', () => {
    const on = calc([base([dForE])], true);
    const off = calc([base([dForE])], false);
    expect(on.totalPoints).toEqual(off.totalPoints);
    expect(on.wonSoli).toEqual(off.wonSoli);
  });

  test('Vertretung an: Stammspieler sammelt ueber Boegen', () => {
    const s2 = sheetWith({
      id: 's2',
      players: [alice, bob, carol, dave],
      games: [classicReWin(['c', 'd'], ['a', 'b'])],
      substitutions: [dForE],
    });
    const r = byPlayer(calc([base([dForE]), s2], true).placementPoints);
    expect(r['d']).toBe(6);
    expect(r['e']).toBe(6);
  });

  test('Ungueltige Vertretung (Stammspieler spielt selbst) wird ignoriert', () => {
    const invalid = base([{ substituteId: 'd', mainPlayerId: 'a' }]);
    expect(byPlayer(calc([invalid], true).placementPoints)).toEqual(
      byPlayer(calc([invalid], false).placementPoints),
    );
  });

  test('Gast ohne Spiel auf dem Bogen bekommt nichts weiterzugeben', () => {
    const s = sheetWith({
      id: 's5',
      players: [alice, bob, carol, dave, xaver],
      games: [
        createGame({
          rePlayerIds: ['a', 'b'],
          contraPlayerIds: ['c', 'd'],
          sittingOutPlayerId: 'x',
          winner: WinnerSide.re,
          flagCodes: [],
        }),
      ],
      substitutions: [{ substituteId: 'x', mainPlayerId: 'e' }],
    });
    expect(byPlayer(calc([s], true).placementPoints)['e']).toBeUndefined();
  });
});
