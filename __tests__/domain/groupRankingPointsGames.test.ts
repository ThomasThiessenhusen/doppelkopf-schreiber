import { createPointsGame } from '@/domain/models/game';
import { createGameSheet, sheetWithGame } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { createPlayerLookup } from '@/domain/models/playerLookup';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { calculateGroupRankings } from '@/domain/scoring/groupRankingCalculator';

function player(id: string): Player {
  return { id, playerName: id.toUpperCase(), firstName: null, lastName: null };
}

describe('Gruppen-Rangliste mit Punkte-Spielen', () => {
  const pool = ['a', 'b', 'c', 'd'].map(player);
  const lookup = createPlayerLookup(pool);

  function pointsSheet() {
    let sheet = createGameSheet({ players: pool });
    sheet = sheetWithGame(
      sheet,
      createPointsGame({ pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 } }),
    );
    sheet = sheetWithGame(
      sheet,
      createPointsGame({ pointsByPlayerId: { a: 3, b: 0, c: 0, d: -3 } }),
    );
    return sheet;
  }

  test('Spieler eines reinen Punkte-Bogens erscheinen mit Summen und Platzierung', () => {
    const r = calculateGroupRankings({
      sheets: [pointsSheet()],
      defaultMode: BockStackingMode.sequential,
      lookup,
    });
    const total = new Map(r.totalPoints.map((e) => [e.playerId, e.value]));
    expect(total.get('a')).toBe(6);
    expect(total.get('b')).toBe(3);
    expect(total.get('c')).toBe(-3);
    expect(total.get('d')).toBe(-6);
    const place = new Map(r.placementPoints.map((e) => [e.playerId, e.value]));
    expect(place.get('a')).toBe(4);
    expect(place.get('b')).toBe(3);
    expect(place.get('c')).toBe(2);
    expect(place.get('d')).toBe(1);
  });

  test('keine gewonnenen Soli aus Punkte-Spielen', () => {
    const r = calculateGroupRankings({
      sheets: [pointsSheet()],
      defaultMode: BockStackingMode.sequential,
      lookup,
    });
    expect(r.wonSoli.every((e) => e.value === 0)).toBe(true);
    expect(r.wonSoli).toHaveLength(4);
  });

  describe('Soli aus Punkte-Spielen (3:1-Muster)', () => {
    function soliOf(games: Record<string, number>[]) {
      let sheet = createGameSheet({ players: pool });
      for (const pointsByPlayerId of games) {
        sheet = sheetWithGame(sheet, createPointsGame({ pointsByPlayerId }));
      }
      const r = calculateGroupRankings({
        sheets: [sheet],
        defaultMode: BockStackingMode.sequential,
        lookup,
      });
      return new Map(r.wonSoli.map((e) => [e.playerId, e.value]));
    }

    test('einer +3x, drei je -x: gewonnenes Solo fuer den Solisten', () => {
      const soli = soliOf([
        { a: 12, b: -4, c: -4, d: -4 },
        { a: 3, b: 3, c: -3, d: -3 },
      ]);
      expect(soli.get('a')).toBe(1);
      expect(soli.get('b')).toBe(0);
    });

    test('Solist mit Minuspunkten (verlorenes Solo) zaehlt nicht', () => {
      const soli = soliOf([{ a: -9, b: 3, c: 3, d: 3 }]);
      expect([...soli.values()].every((v) => v === 0)).toBe(true);
    });

    test('Punktegleichheit 0/0/0/0 ist kein Solo', () => {
      const soli = soliOf([{ a: 0, b: 0, c: 0, d: 0 }]);
      expect([...soli.values()].every((v) => v === 0)).toBe(true);
    });
  });
});
