import { createGame, WinnerSide } from '@/domain/models/game';
import { createGameSheet, sheetWithGame, type GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockLevel } from '@/domain/scoring/bockLevel';
import {
  bockStateEmpty,
  currentBockState,
  resolveBock,
} from '@/domain/scoring/bockResolver';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';

const RE_ANNOUNCED = 'reAnnounced';
const CONTRA_ANNOUNCED = 'contraAnnounced';

function makeSheet(playerCount = 4): GameSheet {
  const players: Player[] = [
    { id: 'a', firstName: 'Anna', lastName: null, nickname: null },
    { id: 'b', firstName: 'Ben', lastName: null, nickname: null },
    { id: 'c', firstName: 'Carla', lastName: null, nickname: null },
    { id: 'd', firstName: 'Dirk', lastName: null, nickname: null },
  ];
  if (playerCount === 5) {
    players.push({ id: 'e', firstName: 'Eva', lastName: null, nickname: null });
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
