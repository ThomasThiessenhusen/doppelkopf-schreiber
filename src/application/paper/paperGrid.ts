import type { ScanSheet } from '@/application/import/scanParser';
import { createPointsGame, type Game } from '@/domain/models/game';
import {
  copyGameSheet,
  createGameSheet,
  gamesPerRound,
  type GameSheet,
} from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { Round } from '@/domain/models/round';

/** Eine Zelle des Rasters: Punkte, oder `null` fuer leer/Aussetzer. */
export type PaperCell = number | null;

export type PlayerAssignment =
  | { readonly kind: 'unassigned' }
  | { readonly kind: 'pool'; readonly playerId: string }
  | { readonly kind: 'new'; readonly name: string };

/** Arbeitsstand beim Erfassen eines Papier-Spielbogens. */
export interface PaperGrid {
  readonly title: string;
  readonly playedAt: Date;
  /** Spaltenueberschriften (Namen, so wie sie auf dem Papier stehen). */
  readonly columnNames: readonly string[];
  readonly assignments: readonly PlayerAssignment[];
  readonly rows: readonly (readonly PaperCell[])[];
  /** Summenzeile des Papiers; nur fuer einen Hinweis, wird nie importiert. */
  readonly paperTotals: readonly (number | null)[] | null;
  readonly uncertain: readonly { readonly game: number; readonly player: number }[];
}

export function emptyGrid(playerCount: 4 | 5, playedAt: Date): PaperGrid {
  return {
    title: '',
    playedAt,
    columnNames: Array.from({ length: playerCount }, () => ''),
    assignments: Array.from({ length: playerCount }, (): PlayerAssignment => ({ kind: 'unassigned' })),
    rows: [],
    paperTotals: null,
    uncertain: [],
  };
}

export function gridFromScan(scan: ScanSheet, pool: readonly Player[]): PaperGrid {
  return {
    title: scan.title ?? '',
    playedAt: scan.playedAt ?? new Date(),
    columnNames: [...scan.players],
    assignments: scan.players.map((name): PlayerAssignment => {
      const playerId = matchPlayer(name, pool);
      return playerId === null ? { kind: 'unassigned' } : { kind: 'pool', playerId };
    }),
    rows: scan.games.map((row) => [...row]),
    paperTotals: scan.totals === null ? null : [...scan.totals],
    uncertain: scan.uncertain.map((u) => ({ ...u })),
  };
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Sucht den Pool-Spieler zu einem Namen: exakter Treffer (ohne Gross-/
 * Kleinschreibung und Randleerzeichen), sonst eindeutiger Praefix-Treffer.
 * Mehrdeutige oder fehlende Treffer ergeben `null`.
 */
export function matchPlayer(name: string, pool: readonly Player[]): string | null {
  const n = normalizeName(name);
  if (n === '') return null;
  const exact = pool.filter((p) => normalizeName(p.playerName) === n);
  if (exact.length === 1) return exact[0]!.id;
  if (exact.length > 1) return null;
  const prefix = pool.filter((p) => normalizeName(p.playerName).startsWith(n));
  return prefix.length === 1 ? prefix[0]!.id : null;
}

/**
 * Liest eine Zelleneingabe. Leer oder Strich → `null` (Aussetzer/leer),
 * ganze Zahl (auch mit `+`, `-` oder Unicode-Minus) → Zahl, sonst `'invalid'`.
 */
export function parseCellInput(text: string): number | null | 'invalid' {
  const t = text.trim().replace(/−/g, '-');
  if (t === '' || t === '-' || t === '—') return null;
  if (!/^[+-]?\d+$/.test(t)) return 'invalid';
  const n = Number(t);
  return n === 0 ? 0 : n;
}

function replaceRow(grid: PaperGrid, row: number, cells: readonly PaperCell[]): PaperGrid {
  return { ...grid, rows: grid.rows.map((r, i) => (i === row ? cells : r)) };
}

export function setCell(grid: PaperGrid, row: number, col: number, value: PaperCell): PaperGrid {
  const current = grid.rows[row];
  if (current === undefined) return grid;
  return replaceRow(grid, row, current.map((c, i) => (i === col ? value : c)));
}

/**
 * Neue Zeile: 4 Spieler → lauter Nullen; 5 Spieler → Aussetzer-Vorschlag
 * nach App-Rotation (`rows.length % 5`), vom Nutzer aenderbar.
 */
export function addRow(grid: PaperGrid): PaperGrid {
  const count = grid.columnNames.length;
  const sitter = count === 5 ? grid.rows.length % 5 : -1;
  const row: PaperCell[] = Array.from({ length: count }, (_, i) => (i === sitter ? null : 0));
  return { ...grid, rows: [...grid.rows, row] };
}

export function removeRow(grid: PaperGrid, row: number): PaperGrid {
  return { ...grid, rows: grid.rows.filter((_, i) => i !== row) };
}

/** Setzt den Aussetzer der Zeile auf `col`; die bisherige leere Stelle wird 0. */
export function setRowSitter(grid: PaperGrid, row: number, col: number): PaperGrid {
  const current = grid.rows[row];
  if (current === undefined) return grid;
  return replaceRow(
    grid,
    row,
    current.map((c, i) => (i === col ? null : c === null ? 0 : c)),
  );
}

export function computedColumnTotals(grid: PaperGrid): number[] {
  const totals = grid.columnNames.map(() => 0);
  for (const row of grid.rows) {
    row.forEach((cell, i) => {
      totals[i] = (totals[i] ?? 0) + (cell ?? 0);
    });
  }
  return totals;
}

export interface GridValidation {
  readonly rowIssues: readonly { row: number; kind: 'sum' | 'empty' | 'sitter' }[];
  readonly assignmentIssues: readonly { col: number; kind: 'unassigned' | 'duplicate' }[];
  /** Neuer Name gleicht (ohne Schreibweise) einem Pool-Spieler; nicht blockierend. */
  readonly similarNameWarnings: readonly { col: number; poolPlayerId: string }[];
  /** Summenzeile des Papiers weicht von den berechneten Summen ab; nicht blockierend. */
  readonly paperTotalsMismatch: boolean;
  readonly canConfirm: boolean;
}

export function validateGrid(grid: PaperGrid, pool: readonly Player[]): GridValidation {
  const playerCount = grid.columnNames.length;
  const rowIssues: { row: number; kind: 'sum' | 'empty' | 'sitter' }[] = [];
  grid.rows.forEach((cells, row) => {
    const nulls = cells.filter((c) => c === null).length;
    if (playerCount === 4 && nulls > 0) rowIssues.push({ row, kind: 'empty' });
    if (playerCount === 5 && nulls !== 1) rowIssues.push({ row, kind: 'sitter' });
    const sum = cells.reduce<number>((a, c) => a + (c ?? 0), 0);
    if (sum !== 0) rowIssues.push({ row, kind: 'sum' });
  });

  const assignmentIssues: { col: number; kind: 'unassigned' | 'duplicate' }[] = [];
  const similarNameWarnings: { col: number; poolPlayerId: string }[] = [];
  const seen = new Set<string>();
  grid.assignments.forEach((a, col) => {
    if (a.kind === 'unassigned' || (a.kind === 'new' && normalizeName(a.name) === '')) {
      assignmentIssues.push({ col, kind: 'unassigned' });
      return;
    }
    const key = a.kind === 'pool' ? `p:${a.playerId}` : `n:${normalizeName(a.name)}`;
    if (seen.has(key)) assignmentIssues.push({ col, kind: 'duplicate' });
    seen.add(key);
    if (a.kind === 'new') {
      const same = pool.find((p) => normalizeName(p.playerName) === normalizeName(a.name));
      if (same !== undefined) similarNameWarnings.push({ col, poolPlayerId: same.id });
    }
  });

  const computed = computedColumnTotals(grid);
  const paperTotalsMismatch =
    grid.paperTotals !== null &&
    grid.paperTotals.some((t, i) => t !== null && t !== computed[i]);

  return {
    rowIssues,
    assignmentIssues,
    similarNameWarnings,
    paperTotalsMismatch,
    canConfirm: grid.rows.length >= 1 && rowIssues.length === 0 && assignmentIssues.length === 0,
  };
}

/**
 * Baut den Bogen aus einem gueltigen Raster. `players` steht in
 * Spaltenreihenfolge. Spiele werden der Reihe nach in Runden zu
 * `gamesPerRound` aufgeteilt; `playedAt` je Spiel = Spieldatum + Index in
 * Sekunden. Wirft bei Zeilen mit Summe ungleich 0.
 */
export function buildSheetFromGrid(grid: PaperGrid, players: readonly Player[]): GameSheet {
  if (players.length !== grid.columnNames.length) {
    throw new Error('Spielerliste passt nicht zur Spaltenzahl.');
  }
  const base = createGameSheet({ players, title: grid.title, at: grid.playedAt });
  const games: Game[] = grid.rows.map((cells, i) => {
    const pointsByPlayerId: Record<string, number> = {};
    let sittingOutPlayerId: string | null = null;
    cells.forEach((cell, col) => {
      const id = players[col]!.id;
      if (cell === null) sittingOutPlayerId = id;
      else pointsByPlayerId[id] = cell;
    });
    return createPointsGame({
      pointsByPlayerId,
      sittingOutPlayerId,
      playedAt: new Date(grid.playedAt.getTime() + i * 1000),
    });
  });
  const size = gamesPerRound(base);
  const rounds: Round[] = [];
  for (let start = 0; start < games.length; start += size) {
    rounds.push({ index: rounds.length, games: games.slice(start, start + size) });
  }
  return copyGameSheet(base, { rounds });
}
