import { createGame, WinnerSide } from '@/domain/models/game';
import { createGameSheet, sheetWithGame } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockLevel } from '@/domain/scoring/bockLevel';
import {
  crossSumGame,
  crossSumSheet,
  scoreFor,
  totalFor,
  totalsFor,
} from '@/domain/scoring/scoreCalculator';
import {
  contraAnnouncedSchwarz,
  contraAnnouncedUnder30,
  contraAnnouncedUnder60,
  contraAnnouncedUnder90,
  contraDoppelkopf1,
  contraDoppelkopf2,
  contraDoppelkopf3,
  contraFuchsLetzterStich,
  contraKarlchen,
  contraKarlchenGefangen,
  reAnnounced,
  reAnnouncedUnder30,
  reAnnouncedUnder60,
  reAnnouncedUnder90,
  reDoppelkopf1,
  reDoppelkopf2,
  reDulleGefangen,
  reFuchs1,
  reFuchs2,
  reKarlchen,
} from '@/domain/scoring/scoringRules';

describe('scoreFor', () => {
  test('Re gewinnt ohne Sonderpunkte: +1 / -1', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(1);
    expect(score.contraPerPlayer).toBe(-1);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Kontra gewinnt: +2 fuer Kontra-Spieler', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [],
    });
    const score = scoreFor(game);
    expect(score.contraPerPlayer).toBe(2);
    expect(score.rePerPlayer).toBe(-2);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Re gewinnt mit Unter 90, Unter 60, Schwarz: +4', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: ['under90', 'under60', 'schwarz'],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(4);
    expect(score.contraPerPlayer).toBe(-4);
  });

  test('Karlchen Re bei Re-Sieg: Spielwert +1', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [reKarlchen.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(2);
    expect(score.contraPerPlayer).toBe(-2);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Karlchen Re bei Re-Niederlage: Spielwert -1 fuer Kontra', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [reKarlchen.code],
    });
    const score = scoreFor(game);
    expect(score.contraPerPlayer).toBe(1);
    expect(score.rePerPlayer).toBe(-1);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Karlchen Kontra bei Kontra-Sieg: Spielwert +1', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [contraKarlchen.code],
    });
    const score = scoreFor(game);
    expect(score.contraPerPlayer).toBe(3);
    expect(score.rePerPlayer).toBe(-3);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Karlchen Kontra bei Kontra-Niederlage: Spielwert -1 fuer Re', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [contraKarlchen.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(0);
    expect(score.contraPerPlayer).toBe(0);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Fuchs Re 1x: Spielwert +1 fuer Re-Sieg', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [reFuchs1.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(2);
    expect(score.contraPerPlayer).toBe(-2);
  });

  test('Fuchs Re 2x: Spielwert +2 fuer Re-Sieg', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [reFuchs1.code, reFuchs2.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(3);
    expect(score.contraPerPlayer).toBe(-3);
  });

  test('Stufenansage Re bei Re-Sieg: jede Stufe addiert +1 zum Spielwert', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [reAnnouncedUnder90.code, reAnnouncedUnder60.code, reAnnouncedUnder30.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(4);
    expect(score.contraPerPlayer).toBe(-4);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Stufenansage Re bei Kontra-Sieg: Beitraege gehen an den Sieger', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [reAnnouncedUnder90.code, reAnnouncedUnder60.code, reAnnouncedUnder30.code],
    });
    const score = scoreFor(game);
    expect(score.contraPerPlayer).toBe(5);
    expect(score.rePerPlayer).toBe(-5);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Beidseitige Stufenansagen addieren sich (Re Unter 30 + Kontra Schwarz)', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [
        reAnnouncedUnder90.code,
        reAnnouncedUnder60.code,
        reAnnouncedUnder30.code,
        contraAnnouncedUnder90.code,
        contraAnnouncedUnder60.code,
        contraAnnouncedUnder30.code,
        contraAnnouncedSchwarz.code,
      ],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(8);
    expect(score.contraPerPlayer).toBe(-8);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Quersumme = 0 ist Invariante (5 Spieler, einer setzt aus)', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      sittingOutPlayerId: 'p5',
      winner: WinnerSide.re,
      flagCodes: ['under90', 'under60', 'schwarz', 'reAnnounced'],
    });
    const score = scoreFor(game);
    expect(2 * score.rePerPlayer + 2 * score.contraPerPlayer + 0).toBe(0);
  });

  test('Solo gewonnen ohne Sonderpunkte: Solist +3, jeder Kontra -1', () => {
    const game = createGame({
      rePlayerIds: ['p1'],
      contraPlayerIds: ['p2', 'p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [],
      isSolo: true,
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(3);
    expect(score.contraPerPlayer).toBe(-1);
    expect(crossSumGame(score, { reCount: 1, contraCount: 3 })).toBe(0);
  });

  test('Solo verloren: Solist -6, jeder Kontra +2 (Quersumme 0)', () => {
    const game = createGame({
      rePlayerIds: ['p1'],
      contraPlayerIds: ['p2', 'p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [],
      isSolo: true,
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(-6);
    expect(score.contraPerPlayer).toBe(2);
    expect(crossSumGame(score, { reCount: 1, contraCount: 3 })).toBe(0);
  });

  test('Solo gewonnen mit Unter 90: Solist +6, jeder Kontra -2', () => {
    const game = createGame({
      rePlayerIds: ['p1'],
      contraPlayerIds: ['p2', 'p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: ['under90'],
      isSolo: true,
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(6);
    expect(score.contraPerPlayer).toBe(-2);
    expect(crossSumGame(score, { reCount: 1, contraCount: 3 })).toBe(0);
  });

  test('Bock single: Sieger bekommt +2 zusaetzlich', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [],
    });
    const score = scoreFor(game, BockLevel.single);
    expect(score.rePerPlayer).toBe(3);
    expect(score.contraPerPlayer).toBe(-3);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Bock double: Sieger bekommt +4 zusaetzlich', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [],
    });
    const score = scoreFor(game, BockLevel.double);
    expect(score.contraPerPlayer).toBe(6);
    expect(score.rePerPlayer).toBe(-6);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Bock single + Solo gewonnen: Solist 3*(1+2)=9, Kontra je -3', () => {
    const game = createGame({
      rePlayerIds: ['p1'],
      contraPlayerIds: ['p2', 'p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [],
      isSolo: true,
    });
    const score = scoreFor(game, BockLevel.single);
    expect(score.rePerPlayer).toBe(9);
    expect(score.contraPerPlayer).toBe(-3);
    expect(crossSumGame(score, { reCount: 1, contraCount: 3 })).toBe(0);
  });

  test('Bock none entspricht aktuellem Verhalten ohne Bock', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [],
    });
    const without = scoreFor(game);
    const withNone = scoreFor(game, BockLevel.none);
    expect(without.rePerPlayer).toBe(withNone.rePerPlayer);
    expect(without.contraPerPlayer).toBe(withNone.contraPerPlayer);
  });

  test('Doppelkopf Re bei Re-Sieg: Spielwert +1 pro Doppelkopf', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [reDoppelkopf1.code, reDoppelkopf2.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(3);
    expect(score.contraPerPlayer).toBe(-3);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Doppelkopf Kontra bei Re-Sieg: Spielwert -1 pro Doppelkopf', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [contraDoppelkopf1.code, contraDoppelkopf2.code, contraDoppelkopf3.code],
    });
    const score = scoreFor(game);
    expect(score.contraPerPlayer).toBe(2);
    expect(score.rePerPlayer).toBe(-2);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Karlchen gefangen Kontra bei Re-Sieg: Spielwert -1 fuer Re', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [contraKarlchenGefangen.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(0);
    expect(score.contraPerPlayer).toBe(0);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Dulle gefangen Re bei Re-Sieg: Spielwert +1 fuer Re', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.re,
      flagCodes: [reDulleGefangen.code],
    });
    const score = scoreFor(game);
    expect(score.rePerPlayer).toBe(2);
    expect(score.contraPerPlayer).toBe(-2);
    expect(crossSumGame(score)).toBe(0);
  });

  test('Fuchs macht letzten Stich Kontra bei Kontra-Sieg: +1', () => {
    const game = createGame({
      rePlayerIds: ['p1', 'p2'],
      contraPlayerIds: ['p3', 'p4'],
      winner: WinnerSide.contra,
      flagCodes: [contraFuchsLetzterStich.code],
    });
    const score = scoreFor(game);
    expect(score.contraPerPlayer).toBe(3);
    expect(score.rePerPlayer).toBe(-3);
    expect(crossSumGame(score)).toBe(0);
  });
});

describe('totalsFor', () => {
  const players4: ReadonlyArray<Player> = [
    { id: 'a', playerName: 'Anna', firstName: null, lastName: null },
    { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
    { id: 'c', playerName: 'Carla', firstName: null, lastName: null },
    { id: 'd', playerName: 'Dirk', firstName: null, lastName: null },
  ];

  test('aggregiert Punkte ueber mehrere Spiele und bleibt zero-sum', () => {
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
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a', 'c'],
        contraPlayerIds: ['b', 'd'],
        winner: WinnerSide.contra,
        flagCodes: ['under90'],
      }),
    );
    const totals = totalsFor(sheet);
    expect(crossSumSheet(totals)).toBe(0);
    expect(totalFor(totals, 'a')).toBe(-2);
    expect(totalFor(totals, 'b')).toBe(4);
  });

  test('Solo-Spiel im Spielbogen: Quersumme bleibt 0, Solist erhaelt 3*P', () => {
    let sheet = createGameSheet({ players: players4 });
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
    const totals = totalsFor(sheet);
    expect(totalFor(totals, 'a')).toBe(3);
    expect(totalFor(totals, 'b')).toBe(-1);
    expect(totalFor(totals, 'c')).toBe(-1);
    expect(totalFor(totals, 'd')).toBe(-1);
    expect(crossSumSheet(totals)).toBe(0);
  });

  test('aussetzender Spieler erhaelt 0 Punkte', () => {
    const players5: ReadonlyArray<Player> = [
      ...players4,
      { id: 'e', playerName: 'Eva', firstName: null, lastName: null },
    ];
    let sheet = createGameSheet({ players: players5 });
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
    const totals = totalsFor(sheet);
    expect(totalFor(totals, 'e')).toBe(0);
    expect(crossSumSheet(totals)).toBe(0);
  });

  test('totalsFor wertet Bock automatisch aus (sequenziell)', () => {
    let sheet = createGameSheet({ players: players4 });
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a', 'b'],
        contraPlayerIds: ['c', 'd'],
        winner: WinnerSide.contra,
        flagCodes: [reAnnounced.code],
      }),
    );
    sheet = sheetWithGame(
      sheet,
      createGame({
        rePlayerIds: ['a', 'b'],
        contraPlayerIds: ['c', 'd'],
        winner: WinnerSide.re,
        flagCodes: [],
      }),
    );
    const totals = totalsFor(sheet);
    expect(totalFor(totals, 'a')).toBe(-1);
    expect(totalFor(totals, 'b')).toBe(-1);
    expect(totalFor(totals, 'c')).toBe(1);
    expect(totalFor(totals, 'd')).toBe(1);
    expect(crossSumSheet(totals)).toBe(0);
  });
});
