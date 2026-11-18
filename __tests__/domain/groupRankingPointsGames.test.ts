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
});
