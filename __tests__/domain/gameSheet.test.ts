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
