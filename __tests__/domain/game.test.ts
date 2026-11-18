import {
  copyGame,
  createGame,
  createPointsGame,
  gameFromJson,
  gameToJson,
  isPointsGame,
} from '@/domain/models/game';

describe('Punkte-Spiel', () => {
  test('createPointsGame setzt Rohdatenfelder neutral', () => {
    const g = createPointsGame({ pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 } });
    expect(isPointsGame(g)).toBe(true);
    expect(g.rePlayerIds).toEqual([]);
    expect(g.contraPlayerIds).toEqual([]);
    expect(g.flagCodes).toEqual([]);
    expect(g.isSolo).toBe(false);
    expect(g.triggersManualBock).toBe(false);
  });

  test('wirft bei Summe ungleich 0', () => {
    expect(() => createPointsGame({ pointsByPlayerId: { a: 3, b: -2 } })).toThrow();
  });

  test('wirft bei nicht ganzzahligen Werten', () => {
    expect(() => createPointsGame({ pointsByPlayerId: { a: 1.5, b: -1.5 } })).toThrow();
  });

  test('wirft bei leerer Map', () => {
    expect(() => createPointsGame({ pointsByPlayerId: {} })).toThrow();
  });

  test('JSON-Round-Trip erhaelt Punkte und Aussetzer', () => {
    const g = createPointsGame({
      pointsByPlayerId: { a: 3, b: -3, c: 0, d: 0 },
      sittingOutPlayerId: 'e',
    });
    const back = gameFromJson(gameToJson(g));
    expect(back.pointsByPlayerId).toEqual({ a: 3, b: -3, c: 0, d: 0 });
    expect(back.sittingOutPlayerId).toBe('e');
    expect(isPointsGame(back)).toBe(true);
  });

  test('normales Spiel schreibt kein pointsByPlayerId', () => {
    const g = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: 're',
      flagCodes: [],
    });
    expect('pointsByPlayerId' in gameToJson(g)).toBe(false);
    expect(isPointsGame(g)).toBe(false);
  });

  test('altes JSON ohne das Feld ist ein normales Spiel', () => {
    const g = gameFromJson({
      id: 'x',
      playedAt: '2026-01-01T00:00:00.000Z',
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: 're',
      flagCodes: [],
    });
    expect(isPointsGame(g)).toBe(false);
  });

  test('ungueltiges pointsByPlayerId im JSON wird ignoriert', () => {
    const g = gameFromJson({
      id: 'x',
      playedAt: '2026-01-01T00:00:00.000Z',
      rePlayerIds: [],
      contraPlayerIds: [],
      winner: 're',
      flagCodes: [],
      pointsByPlayerId: { a: 'viel' },
    });
    expect(isPointsGame(g)).toBe(false);
  });

  test('copyGame behaelt das Feld und kann es ersetzen', () => {
    const g = createPointsGame({ pointsByPlayerId: { a: 3, b: -3 } });
    expect(copyGame(g, {}).pointsByPlayerId).toEqual({ a: 3, b: -3 });
    expect(copyGame(g, { pointsByPlayerId: { a: 1, b: -1 } }).pointsByPlayerId).toEqual({
      a: 1,
      b: -1,
    });
  });
});
