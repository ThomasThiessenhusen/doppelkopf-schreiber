import { copyGame, createGame, type GamePatch, WinnerSide } from '@/domain/models/game';
import {
  allGames,
  createGameSheet,
  replaceGame,
  sheetWithGame,
  type GameSheet,
} from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockLevel } from '@/domain/scoring/bockLevel';
import {
  bockStateEmpty,
  currentBockState,
  resolveBock,
} from '@/domain/scoring/bockResolver';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { scoreFor, totalsFor } from '@/domain/scoring/scoreCalculator';

const RE_ANNOUNCED = 'reAnnounced';
const CONTRA_ANNOUNCED = 'contraAnnounced';

function makeSheet(playerCount = 4): GameSheet {
  const players: Player[] = [
    { id: 'a', playerName: 'Anna', firstName: null, lastName: null },
    { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
    { id: 'c', playerName: 'Carla', firstName: null, lastName: null },
    { id: 'd', playerName: 'Dirk', firstName: null, lastName: null },
  ];
  if (playerCount === 5) {
    players.push({ id: 'e', playerName: 'Eva', firstName: null, lastName: null });
  }
  return createGameSheet({ players });
}

function classicGame(
  opts: {
    winner?: WinnerSide;
    flagCodes?: string[];
    triggersManualBock?: boolean;
  } = {},
) {
  return createGame({
    rePlayerIds: ['a', 'b'],
    contraPlayerIds: ['c', 'd'],
    winner: opts.winner ?? WinnerSide.re,
    flagCodes: opts.flagCodes ?? [],
    triggersManualBock: opts.triggersManualBock ?? false,
  });
}

function values(levels: Map<string, BockLevel>): BockLevel[] {
  return [...levels.values()];
}

describe('BockResolver — isTrigger', () => {
  test('Re-Ansage verloren -> trigger', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    const levels = resolveBock(sheet, BockStackingMode.sequential);
    expect(levels.size).toBe(1);
    expect([...levels.values()][0]).toBe(BockLevel.none);
  });

  test('Re-Ansage gewonnen -> kein trigger', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.re, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(sheet, classicGame());
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.none);
  });

  test('Kontra-Ansage verloren -> trigger', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.re, flagCodes: [CONTRA_ANNOUNCED] }),
    );
    sheet = sheetWithGame(sheet, classicGame());
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
  });

  test('Verloren ohne Ansage -> kein trigger', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(sheet, classicGame({ winner: WinnerSide.contra }));
    sheet = sheetWithGame(sheet, classicGame());
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[v.length - 1]).toBe(BockLevel.none);
  });

  test('triggersManualBock -> trigger', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(sheet, classicGame({ triggersManualBock: true }));
    sheet = sheetWithGame(sheet, classicGame());
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
  });
});

describe('BockResolver — Bockrunden-Laenge', () => {
  test('4 Spieler: naechste 4 Spiele sind single, das 5. wieder none', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    for (let i = 0; i < 5; i++) {
      sheet = sheetWithGame(sheet, classicGame());
    }
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
    expect(v[2]).toBe(BockLevel.single);
    expect(v[3]).toBe(BockLevel.single);
    expect(v[4]).toBe(BockLevel.single);
    expect(v[5]).toBe(BockLevel.none);
  });

  test('5 Spieler: naechste 5 Spiele sind single, das 6. wieder none', () => {
    let sheet = makeSheet(5);
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a', 'b'],
        contraPlayerIds: ['c', 'd'],
        sittingOutPlayerId: 'e',
        winner: WinnerSide.contra,
        flagCodes: [RE_ANNOUNCED],
      }),
    );
    for (let i = 0; i < 6; i++) {
      sheet = sheetWithGame(
        sheet,
        createGame({
          rePlayerIds: ['a', 'b'],
          contraPlayerIds: ['c', 'd'],
          sittingOutPlayerId: 'e',
          winner: WinnerSide.re,
          flagCodes: [],
        }),
      );
    }
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
    expect(v[5]).toBe(BockLevel.single);
    expect(v[6]).toBe(BockLevel.none);
  });
});

describe('BockResolver — Stapelmodi', () => {
  test('Sequenziell + zweiter Trigger waehrend laufender Runde verlaengert', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(sheet, classicGame());
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    for (let i = 0; i < 6; i++) {
      sheet = sheetWithGame(sheet, classicGame());
    }
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
    expect(v[2]).toBe(BockLevel.single);
    expect(v[3]).toBe(BockLevel.single);
    expect(v[4]).toBe(BockLevel.single);
    expect(v[5]).toBe(BockLevel.single);
    expect(v[6]).toBe(BockLevel.single);
    expect(v[7]).toBe(BockLevel.none);
    expect(v[8]).toBe(BockLevel.none);
  });

  test('Doppelbock + zweiter Trigger waehrend laufender Runde -> double', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    for (let i = 0; i < 6; i++) {
      sheet = sheetWithGame(sheet, classicGame());
    }
    const v = values(resolveBock(sheet, BockStackingMode.doppelbock));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
    expect(v[2]).toBe(BockLevel.double);
    expect(v[3]).toBe(BockLevel.double);
    expect(v[4]).toBe(BockLevel.double);
    expect(v[5]).toBe(BockLevel.single);
    expect(v[6]).toBe(BockLevel.none);
    expect(v[7]).toBe(BockLevel.none);
  });

  test('Doppelbock + Trigger ohne laufende Runde -> single (nicht double)', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(sheet, classicGame());
    const v = values(resolveBock(sheet, BockStackingMode.doppelbock));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
  });
});

describe('BockResolver — Solo', () => {
  test('Solo mit Re-Ansage verloren ist Trigger', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a'],
        contraPlayerIds: ['b', 'c', 'd'],
        winner: WinnerSide.contra,
        flagCodes: [RE_ANNOUNCED],
        isSolo: true,
      }),
    );
    sheet = sheetWithGame(sheet, classicGame());
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[1]).toBe(BockLevel.single);
  });

  test('Solo innerhalb aktiver Bockrunde verbraucht Slot', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a'],
        contraPlayerIds: ['b', 'c', 'd'],
        winner: WinnerSide.re,
        flagCodes: [],
        isSolo: true,
      }),
    );
    for (let i = 0; i < 4; i++) {
      sheet = sheetWithGame(sheet, classicGame());
    }
    const v = values(resolveBock(sheet, BockStackingMode.sequential));
    expect(v[0]).toBe(BockLevel.none);
    expect(v[1]).toBe(BockLevel.single);
    expect(v[2]).toBe(BockLevel.single);
    expect(v[3]).toBe(BockLevel.single);
    expect(v[4]).toBe(BockLevel.single);
    expect(v[5]).toBe(BockLevel.none);
  });
});

test('Leerer Spielbogen liefert leere Map', () => {
  const sheet = makeSheet();
  const levels = resolveBock(sheet, BockStackingMode.sequential);
  expect(levels.size).toBe(0);
});

describe('currentBockState', () => {
  test('Leerer Spielbogen: none, 0 Slots', () => {
    const sheet = makeSheet();
    const state = currentBockState(sheet, BockStackingMode.sequential);
    expect(state).toEqual(bockStateEmpty);
    expect(state.level).toBe(BockLevel.none);
    expect(state.remainingSingle).toBe(0);
    expect(state.remainingDouble).toBe(0);
  });

  test('Nach einem Re-Ansage-Verlust: single, 4 Slots', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    const state = currentBockState(sheet, BockStackingMode.sequential);
    expect(state.level).toBe(BockLevel.single);
    expect(state.remainingSingle).toBe(4);
    expect(state.remainingDouble).toBe(0);
  });

  test('Doppelbock: zwei Trigger -> level=double, remainingDouble=3', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    const state = currentBockState(sheet, BockStackingMode.doppelbock);
    expect(state.level).toBe(BockLevel.double);
    expect(state.remainingDouble).toBe(3);
    expect(state.remainingSingle).toBe(1);
  });
});

describe('BockResolver — ohne Bock (off)', () => {
  function sheetWithTriggers(): GameSheet {
    let sheet = makeSheet();
    sheet = sheetWithGame(
      sheet,
      classicGame({ winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }),
    );
    sheet = sheetWithGame(sheet, classicGame({ triggersManualBock: true }));
    for (let i = 0; i < 4; i++) {
      sheet = sheetWithGame(sheet, classicGame());
    }
    return sheet;
  }

  test('resolveBock liefert fuer jedes Spiel none, auch bei Triggern', () => {
    const sheet = sheetWithTriggers();
    const v = values(resolveBock(sheet, BockStackingMode.off));
    expect(v).toHaveLength(6);
    expect(v.every((l) => l === BockLevel.none)).toBe(true);
  });

  test('currentBockState ist leer, obwohl Trigger vorliegen', () => {
    let sheet = makeSheet();
    sheet = sheetWithGame(sheet, classicGame({ triggersManualBock: true }));
    expect(currentBockState(sheet, BockStackingMode.off)).toEqual(bockStateEmpty);
  });
});

/**
 * Regression: Ein Spiel loest faelschlich eine Bockrunde aus und wird erst
 * erfasst, nachdem schon Folgespiele eingetragen sind. Nach der Korrektur des
 * ausloesenden Spiels duerfen die Folgespiele keinen Bock mehr tragen — weder
 * im Level noch in den Punkten. Hintergrund: Bug-Meldung vom Spielabend
 * 02.11.2026 (5 Spieler, sequenziell), damals nicht reproduzierbar.
 */
describe('BockResolver — Korrektur des ausloesenden Spiels (Regression)', () => {
  const MODES = [BockStackingMode.sequential, BockStackingMode.doppelbock] as const;

  /**
   * Baut einen Bogen: `before` normale Spiele, dann der Ausloeser, dann
   * `after` normale Spiele. Liefert Bogen und ID des Ausloesers.
   */
  function sheetWithTriggerAt(
    playerCount: 4 | 5,
    before: number,
    trigger: GamePatch,
    after: number,
  ): { sheet: GameSheet; triggerId: string } {
    let sheet = makeSheet(playerCount);
    for (let i = 0; i < before; i++) sheet = sheetWithGame(sheet, classicGame());
    const triggerGame = copyGame(classicGame(), trigger);
    sheet = sheetWithGame(sheet, triggerGame);
    for (let i = 0; i < after; i++) sheet = sheetWithGame(sheet, classicGame());
    return { sheet, triggerId: triggerGame.id };
  }

  function correct(sheet: GameSheet, gameId: string, patch: GamePatch): GameSheet {
    const game = [...allGames(sheet)].find((g) => g.id === gameId)!;
    return replaceGame(sheet, copyGame(game, patch));
  }

  /** Erwartete Summen, wenn kein Spiel Bock traegt. */
  function totalsWithoutBock(sheet: GameSheet): Map<string, number> {
    const totals = new Map<string, number>(sheet.playerIds.map((id) => [id, 0]));
    for (const g of allGames(sheet)) {
      const s = scoreFor(g, BockLevel.none);
      for (const id of g.rePlayerIds) totals.set(id, totals.get(id)! + s.rePerPlayer);
      for (const id of g.contraPlayerIds) totals.set(id, totals.get(id)! + s.contraPerPlayer);
    }
    return totals;
  }

  function expectNoBockAnywhere(sheet: GameSheet, mode: BockStackingMode) {
    expect(values(resolveBock(sheet, mode)).every((l) => l === BockLevel.none)).toBe(true);
    expect(currentBockState(sheet, mode)).toEqual(bockStateEmpty);
    expect(totalsFor(sheet, mode).totalsByPlayerId).toEqual(totalsWithoutBock(sheet));
  }

  test.each(MODES)(
    '5 Spieler, Bockrunde ueber Rundengrenze, Gewinner korrigiert (%s)',
    (mode) => {
      // Ausloeser = 4. Spiel von Runde 1, Bockrunde = 5 Spiele bis in Runde 2.
      const { sheet, triggerId } = sheetWithTriggerAt(
        5,
        3,
        { winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] },
        6,
      );
      const levelsBefore = values(resolveBock(sheet, mode));
      expect(levelsBefore.slice(4, 9).every((l) => l !== BockLevel.none)).toBe(true);
      expect(levelsBefore[9]).toBe(BockLevel.none);

      const corrected = correct(sheet, triggerId, { winner: WinnerSide.re });

      expectNoBockAnywhere(corrected, mode);
    },
  );

  test.each(MODES)(
    'Spieler-Zuordnung und Gewinner gemeinsam korrigiert (%s)',
    (mode) => {
      const { sheet, triggerId } = sheetWithTriggerAt(
        5,
        3,
        { winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] },
        6,
      );

      const corrected = correct(sheet, triggerId, {
        rePlayerIds: ['a', 'c'],
        contraPlayerIds: ['b', 'd'],
        winner: WinnerSide.re,
      });

      expectNoBockAnywhere(corrected, mode);
    },
  );

  test.each([
    ['Re-Ansage entfernt', { winner: WinnerSide.contra, flagCodes: [RE_ANNOUNCED] }, { flagCodes: [] }],
    [
      'Kontra-Ansage, Gewinner korrigiert',
      { winner: WinnerSide.re, flagCodes: [CONTRA_ANNOUNCED] },
      { winner: WinnerSide.contra },
    ],
    ['Pflichtbock ausgeschaltet', { triggersManualBock: true }, { triggersManualBock: false }],
  ] as const)('4 Spieler: %s', (_name, trigger, fix) => {
    for (const mode of MODES) {
      const { sheet, triggerId } = sheetWithTriggerAt(4, 0, { ...trigger }, 3);
      expect(values(resolveBock(sheet, mode)).slice(1)).toEqual([
        BockLevel.single,
        BockLevel.single,
        BockLevel.single,
      ]);

      expectNoBockAnywhere(correct(sheet, triggerId, { ...fix }), mode);
    }
  });
});
