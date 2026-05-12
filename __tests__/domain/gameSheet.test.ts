import { createGame, gameFromJson, gameToJson, WinnerSide } from '@/domain/models/game';
import {
  copyGameSheet,
  createGameSheet,
  gameSheetFromJson,
  gameSheetToJson,
  gamesPerRound,
  nextSittingOutPlayer,
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
  test('5 Spieler: Aussetzer rotiert "der Reihe nach"', () => {
    let sheet = createGameSheet({ players: players5 });
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s = nextSittingOutPlayer(sheet);
      if (s === null) throw new Error('Erwartet Aussetzer bei 5 Spielern');
      out.push(s.id);
      sheet = sheetWithGame(
        sheet,
        createGame({
          rePlayerIds: sheet.players
            .filter((p) => p.id !== s.id)
            .slice(0, 2)
            .map((p) => p.id),
          contraPlayerIds: sheet.players
            .filter((p) => p.id !== s.id)
            .slice(2)
            .map((p) => p.id),
          sittingOutPlayerId: s.id,
          winner: WinnerSide.re,
          flagCodes: [],
        }),
      );
    }
    expect(out).toEqual(['a', 'b', 'c', 'd', 'e', 'a', 'b', 'c', 'd', 'e']);
  });

  test('4 Spieler: kein Aussetzer', () => {
    const sheet = createGameSheet({ players: players4 });
    expect(nextSittingOutPlayer(sheet)).toBeNull();
    expect(gamesPerRound(sheet)).toBe(4);
  });

  test('Runden werden automatisch angelegt nach gamesPerRound Spielen', () => {
    let sheet = createGameSheet({ players: players4 });
    for (let i = 0; i < 5; i++) {
      sheet = sheetWithGame(
        sheet,
        createGame({
          rePlayerIds: ['a', 'b'],
          contraPlayerIds: ['c', 'd'],
          winner: WinnerSide.re,
          flagCodes: [],
        }),
      );
    }
    expect(sheet.rounds.length).toBe(2);
    expect(sheet.rounds[0]!.games.length).toBe(4);
    expect(sheet.rounds[1]!.games.length).toBe(1);
  });

  test('JSON-Roundtrip erhaelt alle Daten', () => {
    let sheet = createGameSheet({ players: players5, title: 'Stammtisch' });
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a', 'b'],
        contraPlayerIds: ['c', 'd'],
        sittingOutPlayerId: 'e',
        winner: WinnerSide.contra,
        flagCodes: ['under90', 'contraAnnounced'],
      }),
    );
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['b'],
        contraPlayerIds: ['c', 'd', 'e'],
        sittingOutPlayerId: 'a',
        winner: WinnerSide.re,
        flagCodes: [],
        isSolo: true,
      }),
    );

    const json = gameSheetToJson(sheet);
    const restored = gameSheetFromJson(json);

    expect(restored.id).toBe(sheet.id);
    expect(restored.title).toBe('Stammtisch');
    expect(restored.players.map((p) => p.playerName)).toEqual([
      'Anna',
      'Ben',
      'Carla',
      'Dirk',
      'Eva',
    ]);
    expect(restored.rounds[0]!.games[0]!.flagCodes).toEqual(['under90', 'contraAnnounced']);
    expect(restored.rounds[0]!.games[0]!.winner).toBe(WinnerSide.contra);
    expect(restored.rounds[0]!.games[0]!.isSolo).toBe(false);
    expect(restored.rounds[0]!.games[1]!.isSolo).toBe(true);
    expect(restored.rounds[0]!.games[1]!.rePlayerIds).toEqual(['b']);
  });

  test('Game.triggersManualBock wird in toJson/fromJson durchgereicht', () => {
    const game = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: WinnerSide.re,
      flagCodes: [],
      triggersManualBock: true,
    });
    const restored = gameFromJson(gameToJson(game));
    expect(restored.triggersManualBock).toBe(true);
  });

  test('Game.triggersManualBock default ist false (alte JSON ohne Feld)', () => {
    const raw: Record<string, unknown> = {
      id: 'g1',
      playedAt: new Date().toISOString(),
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      sittingOutPlayerId: null,
      winner: 're',
      flagCodes: [],
      note: null,
      isSolo: false,
    };
    const game = gameFromJson(raw);
    expect(game.triggersManualBock).toBe(false);
  });

  test('GameSheet.stackingModeOverride wird im JSON durchgereicht', () => {
    const sheet = copyGameSheet(createGameSheet({ players: players4 }), {
      stackingModeOverride: BockStackingMode.doppelbock,
    });
    const restored = gameSheetFromJson(gameSheetToJson(sheet));
    expect(restored.stackingModeOverride).toBe(BockStackingMode.doppelbock);
  });

  test('GameSheet.stackingModeOverride default ist null', () => {
    const sheet = createGameSheet({ players: players4 });
    expect(sheet.stackingModeOverride).toBeNull();
    const restored = gameSheetFromJson(gameSheetToJson(sheet));
    expect(restored.stackingModeOverride).toBeNull();
  });

  describe('GameSheet.groupId', () => {
    test('Default ist null fuer neue Boegen', () => {
      const sheet = createGameSheet({ players: players4 });
      expect(sheet.groupId).toBeNull();
    });

    test('JSON-Roundtrip mit groupId', () => {
      const original = copyGameSheet(createGameSheet({ players: players4 }), {
        groupId: 'group-42',
      });
      const restored = gameSheetFromJson(gameSheetToJson(original));
      expect(restored.groupId).toBe('group-42');
    });

    test('JSON ohne groupId-Feld liest als null (Migration)', () => {
      const json: Record<string, unknown> = {
        id: 'sheet-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        players: [
          { id: 'a', firstName: 'Anna' },
          { id: 'b', firstName: 'Ben' },
          { id: 'c', firstName: 'Carla' },
          { id: 'd', firstName: 'Dirk' },
        ],
        rounds: [],
        dirty: false,
      };
      const sheet = gameSheetFromJson(json);
      expect(sheet.groupId).toBeNull();
    });

    test('copyGameSheet setzt groupId auf null mit explizitem null-Wert', () => {
      const sheet = copyGameSheet(createGameSheet({ players: players4 }), { groupId: 'g-1' });
      const cleared = copyGameSheet(sheet, { groupId: null });
      expect(cleared.groupId).toBeNull();
    });
  });

  test('replaceGame ersetzt ein Spiel anhand seiner ID', () => {
    let sheet = createGameSheet({ players: players4 });
    const original = createGame({
      rePlayerIds: ['a', 'b'],
      contraPlayerIds: ['c', 'd'],
      winner: WinnerSide.re,
      flagCodes: [],
    });
    sheet = sheetWithGame(sheet, original);
    const updated = { ...original, winner: WinnerSide.contra };
    sheet = replaceGame(sheet, updated);
    expect(sheet.rounds[0]!.games[0]!.winner).toBe(WinnerSide.contra);
  });

  test('removeGame entfernt Spiel und nummeriert Runden neu', () => {
    let sheet = createGameSheet({ players: players4 });
    const games = [];
    for (let i = 0; i < 5; i++) {
      const g = createGame({
        rePlayerIds: ['a', 'b'],
        contraPlayerIds: ['c', 'd'],
        winner: WinnerSide.re,
        flagCodes: [],
      });
      games.push(g);
      sheet = sheetWithGame(sheet, g);
    }
    sheet = removeGame(sheet, games[0]!.id);
    sheet = removeGame(sheet, games[1]!.id);
    sheet = removeGame(sheet, games[2]!.id);
    sheet = removeGame(sheet, games[3]!.id);
    expect(sheet.rounds.length).toBe(1);
    expect(sheet.rounds[0]!.index).toBe(0);
    expect(sheet.rounds[0]!.games.length).toBe(1);
    expect(totalGames(sheet)).toBe(1);
  });
});
