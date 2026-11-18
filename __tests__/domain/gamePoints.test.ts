import { createGame, createPointsGame, type Game } from '@/domain/models/game';
import { createGameSheet, sheetWithGame, type GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockLevel } from '@/domain/scoring/bockLevel';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { gamePointsByPlayer, gameRowsFor } from '@/domain/scoring/gamePoints';
import { totalsFor } from '@/domain/scoring/scoreCalculator';

function player(id: string): Player {
  return { id, playerName: id.toUpperCase(), firstName: null, lastName: null };
}

function sheetOf(ids: readonly string[], games: readonly Game[]): GameSheet {
  let sheet = createGameSheet({ players: ids.map(player) });
  for (const g of games) sheet = sheetWithGame(sheet, g);
  return sheet;
}

const four = ['a', 'b', 'c', 'd'];

describe('gamePointsByPlayer', () => {
  test('normales Spiel stimmt mit scoreFor ueberein', () => {
    const g = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: 're',
      flagCodes: [],
    });
    const m = gamePointsByPlayer(g, BockLevel.none);
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(1);
    expect(m.get('c')).toBe(-1);
    expect(m.get('d')).toBe(-1);
  });

  test('Punkte-Spiel liest die Punkte direkt', () => {
    const g = createPointsGame({ pointsByPlayerId: { a: 5, b: -5 } });
    const m = gamePointsByPlayer(g, BockLevel.single);
    expect(m.get('a')).toBe(5);
    expect(m.get('b')).toBe(-5);
    expect(m.size).toBe(2);
  });
});

describe('totalsFor mit Punkte-Spielen', () => {
  test('summiert reine Punkte-Spiele', () => {
    const sheet = sheetOf(four, [
      createPointsGame({ pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 } }),
      createPointsGame({ pointsByPlayerId: { a: -9, b: 3, c: 3, d: 3 } }),
    ]);
    const t = totalsFor(sheet, BockStackingMode.sequential).totalsByPlayerId;
    expect(t.get('a')).toBe(-6);
    expect(t.get('b')).toBe(6);
    expect(t.get('c')).toBe(0);
    expect(t.get('d')).toBe(0);
  });

  test('gemischter Bogen: normales Solo plus Punkte-Spiel', () => {
    const solo = createGame({
      rePlayerIds: ['a'],
      contraPlayerIds: ['b', 'c', 'd'],
      winner: 're',
      flagCodes: [],
      isSolo: true,
    });
    const sheet = sheetOf(four, [
      solo,
      createPointsGame({ pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 } }),
    ]);
    const t = totalsFor(sheet, BockStackingMode.sequential).totalsByPlayerId;
    expect(t.get('a')).toBe(6);
    expect(t.get('b')).toBe(2);
    expect(t.get('c')).toBe(-4);
    expect(t.get('d')).toBe(-4);
  });
});

describe('gameRowsFor', () => {
  test('Punkte-Spiel loest keinen Bock aus', () => {
    const normal = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: 're',
      flagCodes: [],
    });
    const sheet = sheetOf(four, [
      createPointsGame({ pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 } }),
      normal,
    ]);
    const rows = gameRowsFor(sheet, BockStackingMode.sequential);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.bockLevel).toBe(BockLevel.none);
  });

  test('5er-Bogen: Aussetzer bleibt erhalten und fehlt in der Map', () => {
    const sheet = sheetOf(['a', 'b', 'c', 'd', 'e'], [
      createPointsGame({
        pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 },
        sittingOutPlayerId: 'e',
      }),
    ]);
    const row = gameRowsFor(sheet, BockStackingMode.sequential)[0]!;
    expect(row.sittingOutPlayerId).toBe('e');
    expect(row.pointsByPlayerId.has('e')).toBe(false);
    expect(row.soloPlayerId).toBeNull();
  });

  test('normales Solo meldet den Solisten', () => {
    const solo = createGame({
      rePlayerIds: ['b'],
      contraPlayerIds: ['a', 'c', 'd'],
      winner: 'contra',
      flagCodes: [],
      isSolo: true,
    });
    const row = gameRowsFor(sheetOf(four, [solo]), BockStackingMode.sequential)[0]!;
    expect(row.soloPlayerId).toBe('b');
  });
});
