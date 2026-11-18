import {
  addRow,
  buildSheetFromGrid,
  computedColumnTotals,
  emptyGrid,
  gridFromScan,
  matchPlayer,
  parseCellInput,
  removeRow,
  setCell,
  setRowSitter,
  validateGrid,
  type PaperGrid,
  type PlayerAssignment,
} from '@/application/paper/paperGrid';
import type { ScanSheet } from '@/application/import/scanParser';
import { allGames } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { totalsFor } from '@/domain/scoring/scoreCalculator';

function player(id: string, name: string): Player {
  return { id, playerName: name, firstName: null, lastName: null };
}

const pool = [player('p1', 'Anna'), player('p2', 'Anton'), player('p3', 'Ben')];
const date = new Date('2026-11-10T12:00:00.000Z');

function pooled(...ids: string[]): PlayerAssignment[] {
  return ids.map((playerId) => ({ kind: 'pool', playerId }));
}

function grid4(rows: (number | null)[][], assignments?: PlayerAssignment[]): PaperGrid {
  return {
    ...emptyGrid(4, date),
    columnNames: ['A', 'B', 'C', 'D'],
    assignments: assignments ?? [
      { kind: 'new', name: 'Neu1' },
      { kind: 'new', name: 'Neu2' },
      { kind: 'new', name: 'Neu3' },
      { kind: 'new', name: 'Neu4' },
    ],
    rows,
  };
}

describe('matchPlayer', () => {
  test('exakter Treffer ohne Gross-/Kleinschreibung und Randleerzeichen', () => {
    expect(matchPlayer('anna ', pool)).toBe('p1');
  });
  test('mehrdeutiger Praefix liefert null', () => {
    expect(matchPlayer('An', pool)).toBeNull();
  });
  test('eindeutiger Praefix', () => {
    expect(matchPlayer('Ant', pool)).toBe('p2');
  });
  test('kein Treffer', () => {
    expect(matchPlayer('Zoe', pool)).toBeNull();
  });
});

describe('parseCellInput', () => {
  test.each([
    ['+3', 3],
    ['3', 3],
    ['-3', -3],
    ['−3', -3],
    ['0', 0],
    ['-0', 0],
    [' 12 ', 12],
  ])('%s -> %s', (text, expected) => {
    expect(parseCellInput(text)).toBe(expected);
  });
  test.each(['', '-', '—', '  '])('leer/Strich %j -> null', (text) => {
    expect(parseCellInput(text)).toBeNull();
  });
  test.each(['3,0', '1.5', 'abc', '--3', '3-'])('ungueltig %j', (text) => {
    expect(parseCellInput(text)).toBe('invalid');
  });
});

describe('Grid-Aufbau', () => {
  test('emptyGrid(4) hat vier unzugeordnete Spalten und keine Zeilen', () => {
    const g = emptyGrid(4, date);
    expect(g.columnNames).toEqual(['', '', '', '']);
    expect(g.assignments).toEqual(Array(4).fill({ kind: 'unassigned' }));
    expect(g.rows).toEqual([]);
    expect(g.paperTotals).toBeNull();
  });

  test('gridFromScan ordnet automatisch zu und uebernimmt Raster', () => {
    const scan: ScanSheet = {
      title: 'Dienstag',
      playedAt: date,
      players: ['Anna', 'Ben', 'Zoe', 'Anton'],
      games: [[3, 3, -3, -3]],
      totals: [3, 3, -3, -3],
      uncertain: [{ game: 0, player: 2 }],
    };
    const g = gridFromScan(scan, pool);
    expect(g.title).toBe('Dienstag');
    expect(g.columnNames).toEqual(['Anna', 'Ben', 'Zoe', 'Anton']);
    expect(g.assignments).toEqual([
      { kind: 'pool', playerId: 'p1' },
      { kind: 'pool', playerId: 'p3' },
      { kind: 'unassigned' },
      { kind: 'pool', playerId: 'p2' },
    ]);
    expect(g.rows).toEqual([[3, 3, -3, -3]]);
    expect(g.paperTotals).toEqual([3, 3, -3, -3]);
    expect(g.uncertain).toEqual([{ game: 0, player: 2 }]);
  });

  test('addRow: 4er-Zeile aus Nullen, 5er-Zeile mit Aussetzer-Vorschlag', () => {
    expect(addRow(emptyGrid(4, date)).rows).toEqual([[0, 0, 0, 0]]);
    const five = addRow(addRow(emptyGrid(5, date)));
    expect(five.rows).toEqual([
      [null, 0, 0, 0, 0],
      [0, null, 0, 0, 0],
    ]);
  });

  test('setCell und removeRow veraendern das Original nicht', () => {
    const g = grid4([[1, -1, 0, 0], [2, -2, 0, 0]]);
    const g2 = setCell(g, 0, 2, 5);
    expect(g.rows[0]![2]).toBe(0);
    expect(g2.rows[0]![2]).toBe(5);
    expect(removeRow(g, 0).rows).toEqual([[2, -2, 0, 0]]);
  });

  test('setRowSitter verschiebt den Aussetzer und setzt die alte Stelle auf 0', () => {
    const g: PaperGrid = { ...emptyGrid(5, date), rows: [[3, 3, -3, -3, null]] };
    expect(setRowSitter(g, 0, 1).rows).toEqual([[3, null, -3, -3, 0]]);
  });
});

describe('computedColumnTotals', () => {
  test('summiert je Spalte, null zaehlt 0', () => {
    const g: PaperGrid = {
      ...emptyGrid(5, date),
      rows: [
        [3, 3, -3, -3, null],
        [null, 1, 1, -2, 0],
      ],
    };
    expect(computedColumnTotals(g)).toEqual([3, 4, -2, -5, 0]);
  });
});

describe('validateGrid', () => {
  test('0 Zeilen: nicht bestaetigbar', () => {
    const v = validateGrid(grid4([], pooled('p1', 'p2', 'p3', 'x')), pool);
    expect(v.canConfirm).toBe(false);
  });

  test('gueltige Zeile mit neuen Spielern: bestaetigbar', () => {
    const v = validateGrid(grid4([[3, 3, -3, -3]]), pool);
    expect(v.rowIssues).toEqual([]);
    expect(v.assignmentIssues).toEqual([]);
    expect(v.canConfirm).toBe(true);
  });

  test('einzelne Zeile (n = 1) reicht', () => {
    expect(validateGrid(grid4([[0, 0, 0, 0]]), pool).canConfirm).toBe(true);
  });

  test('Zeilensumme ungleich 0', () => {
    const v = validateGrid(grid4([[3, 3, -3, -2]]), pool);
    expect(v.rowIssues).toContainEqual({ row: 0, kind: 'sum' });
    expect(v.canConfirm).toBe(false);
  });

  test('4er-Zeile mit leerem Feld', () => {
    const v = validateGrid(grid4([[3, 3, -6, null]]), pool);
    expect(v.rowIssues).toContainEqual({ row: 0, kind: 'empty' });
    expect(v.canConfirm).toBe(false);
  });

  test('5er-Zeile ohne und mit zwei Aussetzern', () => {
    const base = {
      ...emptyGrid(5, date),
      assignments: ['a', 'b', 'c', 'd', 'e'].map((name) => ({ kind: 'new', name }) as const),
    };
    const none = validateGrid({ ...base, rows: [[3, 3, -3, -3, 0]] }, pool);
    expect(none.rowIssues).toContainEqual({ row: 0, kind: 'sitter' });
    const two = validateGrid({ ...base, rows: [[3, 3, -3, null, null]] }, pool);
    expect(two.rowIssues).toContainEqual({ row: 0, kind: 'sitter' });
    const ok = validateGrid({ ...base, rows: [[3, 3, -3, -3, null]] }, pool);
    expect(ok.rowIssues).toEqual([]);
    expect(ok.canConfirm).toBe(true);
  });

  test('unzugeordnete Spalte blockiert', () => {
    const g = grid4([[3, 3, -3, -3]], [
      { kind: 'pool', playerId: 'p1' },
      { kind: 'unassigned' },
      { kind: 'new', name: 'X' },
      { kind: 'new', name: 'Y' },
    ]);
    const v = validateGrid(g, pool);
    expect(v.assignmentIssues).toContainEqual({ col: 1, kind: 'unassigned' });
    expect(v.canConfirm).toBe(false);
  });

  test('derselbe Pool-Spieler zweimal ist ein Duplikat', () => {
    const g = grid4([[3, 3, -3, -3]], pooled('p1', 'p1', 'p2', 'p3'));
    const v = validateGrid(g, pool);
    expect(v.assignmentIssues).toContainEqual({ col: 1, kind: 'duplicate' });
    expect(v.canConfirm).toBe(false);
  });

  test('zwei neue Namen, die sich nur durch Schreibweise unterscheiden, sind ein Duplikat', () => {
    const g = grid4([[3, 3, -3, -3]], [
      { kind: 'new', name: 'Ben2' },
      { kind: 'new', name: 'Zoe' },
      { kind: 'new', name: ' zoe ' },
      { kind: 'new', name: 'Max' },
    ]);
    const v = validateGrid(g, pool);
    expect(v.assignmentIssues).toContainEqual({ col: 2, kind: 'duplicate' });
    expect(v.canConfirm).toBe(false);
  });

  test('neuer Name gleich Pool-Name ist nur eine Warnung', () => {
    const g = grid4([[3, 3, -3, -3]], [
      { kind: 'new', name: 'anna' },
      { kind: 'new', name: 'B' },
      { kind: 'new', name: 'C' },
      { kind: 'new', name: 'D' },
    ]);
    const v = validateGrid(g, pool);
    expect(v.similarNameWarnings).toEqual([{ col: 0, poolPlayerId: 'p1' }]);
    expect(v.canConfirm).toBe(true);
  });

  test('abweichende Papier-Summenzeile blockiert nicht', () => {
    const g = { ...grid4([[3, 3, -3, -3]]), paperTotals: [1, 1, 1, 1] };
    const v = validateGrid(g, pool);
    expect(v.paperTotalsMismatch).toBe(true);
    expect(v.canConfirm).toBe(true);
  });

  test('passende Papier-Summenzeile meldet keine Abweichung', () => {
    const g = { ...grid4([[3, 3, -3, -3]]), paperTotals: [3, 3, -3, -3] };
    expect(validateGrid(g, pool).paperTotalsMismatch).toBe(false);
  });
});

describe('buildSheetFromGrid', () => {
  const players = [player('a', 'A'), player('b', 'B'), player('c', 'C'), player('d', 'D')];

  test('5 Spiele im 4er-Bogen ergeben Runden 4 + 1, Summen stimmen mit dem Raster', () => {
    const rows = [
      [3, 3, -3, -3],
      [-9, 3, 3, 3],
      [1, -1, 0, 0],
      [0, 0, 2, -2],
      [5, -5, 0, 0],
    ];
    const g = { ...grid4(rows), title: 'Dienstag', playedAt: date };
    const sheet = buildSheetFromGrid(g, players);
    expect(sheet.title).toBe('Dienstag');
    expect(sheet.playerIds).toEqual(['a', 'b', 'c', 'd']);
    expect(sheet.rounds.map((r) => r.games.length)).toEqual([4, 1]);
    expect(sheet.rounds.map((r) => r.index)).toEqual([0, 1]);
    const totals = totalsFor(sheet, BockStackingMode.sequential).totalsByPlayerId;
    expect(['a', 'b', 'c', 'd'].map((id) => totals.get(id))).toEqual(computedColumnTotals(g));
  });

  test('playedAt der Spiele ist Spieldatum plus Index in Sekunden', () => {
    const sheet = buildSheetFromGrid(grid4([[1, -1, 0, 0], [2, -2, 0, 0], [3, -3, 0, 0]]), players);
    const times = [...allGames(sheet)].map((g) => g.playedAt.getTime());
    expect(times).toEqual([0, 1000, 2000].map((ms) => date.getTime() + ms));
  });

  test('5er-Bogen uebernimmt den Aussetzer aus der Zeile', () => {
    const five = [...players, player('e', 'E')];
    const g: PaperGrid = {
      ...emptyGrid(5, date),
      assignments: ['a', 'b', 'c', 'd', 'e'].map((name) => ({ kind: 'new', name }) as const),
      rows: [[3, 3, -3, -3, null], [null, 1, 1, -1, -1]],
    };
    const games = [...allGames(buildSheetFromGrid(g, five))];
    expect(games[0]!.sittingOutPlayerId).toBe('e');
    expect(games[0]!.pointsByPlayerId).toEqual({ a: 3, b: 3, c: -3, d: -3 });
    expect(games[1]!.sittingOutPlayerId).toBe('a');
    expect(games[1]!.pointsByPlayerId!['a']).toBeUndefined();
  });

  test('leerer Titel wird zu null, Stapelmodus bleibt ohne Override', () => {
    const sheet = buildSheetFromGrid({ ...grid4([[1, -1, 0, 0]]), title: '  ' }, players);
    expect(sheet.title).toBeNull();
    expect(sheet.stackingModeOverride).toBeNull();
  });

  test('wirft bei Zeile mit Summe ungleich 0', () => {
    expect(() => buildSheetFromGrid(grid4([[1, 1, 0, 0]]), players)).toThrow();
  });
});
