export class ScanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanParseError';
  }
}

/** Abschrift eines Papier-Spielbogens (von einer externen KI erzeugt). */
export interface ScanSheet {
  readonly title: string | null;
  readonly playedAt: Date | null;
  readonly players: readonly string[];
  /** Pro Spiel ein Wert je Spieler; `null` = leeres Feld/Strich (Aussetzer). */
  readonly games: readonly (readonly (number | null)[])[];
  readonly totals: readonly (number | null)[] | null;
  /** 0-basierte Indizes unsicher gelesener Zellen (innerhalb des Rasters). */
  readonly uncertain: readonly { readonly game: number; readonly player: number }[];
}

/**
 * Liest eine Scan-Datei aus beliebigem Text: Markdown-Codebloecke und
 * Fliesstext drumherum werden ignoriert, das erste gueltige JSON-Objekt zaehlt.
 */
export function parseScanText(raw: string): ScanSheet {
  const json = extractFirstJsonObject(raw);
  if (json === null) {
    throw new ScanParseError('Keine JSON-Daten in der Antwort gefunden.');
  }
  if (json['kind'] !== 'scan') {
    throw new ScanParseError(`Unbekanntes kind-Feld: ${String(json['kind'])} (erwartet scan).`);
  }
  const version = json['formatVersion'];
  if (version !== undefined && version !== 1) {
    throw new ScanParseError(`Unbekannte formatVersion: ${String(version)} (erwartet 1).`);
  }

  const players = readPlayers(json['players']);
  const games = readGames(json['games'], players.length);
  const totals = readTotals(json['totals'], players.length);
  const uncertain = readUncertain(json['uncertain'], games.length, players.length);

  return {
    title: typeof json['title'] === 'string' && json['title'].trim() !== '' ? json['title'].trim() : null,
    playedAt: readPlayedAt(json['playedAt']),
    players,
    games,
    totals,
    uncertain,
  };
}

function readPlayers(v: unknown): string[] {
  if (!Array.isArray(v) || (v.length !== 4 && v.length !== 5)) {
    throw new ScanParseError('players muss 4 oder 5 Spielernamen enthalten.');
  }
  return v.map((name, i) => {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new ScanParseError(`players[${i}] ist kein gueltiger Name.`);
    }
    return name.trim();
  });
}

function readGames(v: unknown, playerCount: number): (number | null)[][] {
  if (!Array.isArray(v)) throw new ScanParseError('games fehlt oder ist keine Liste.');
  return v.map((entry, i) => {
    const row = isObject(entry) ? entry['points'] : undefined;
    if (!Array.isArray(row)) {
      throw new ScanParseError(`Spiel ${i + 1}: points fehlt.`);
    }
    if (row.length !== playerCount) {
      throw new ScanParseError(
        `Spiel ${i + 1}: erwartet ${playerCount} Werte, gefunden ${row.length}.`,
      );
    }
    return row.map((cell) => {
      if (cell === null) return null;
      if (typeof cell === 'number' && Number.isInteger(cell)) return cell;
      throw new ScanParseError(`Spiel ${i + 1}: Wert ${JSON.stringify(cell)} ist keine ganze Zahl.`);
    });
  });
}

function readTotals(v: unknown, playerCount: number): (number | null)[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length !== playerCount) {
    throw new ScanParseError(`totals muss ${playerCount} Werte enthalten.`);
  }
  return v.map((cell) => {
    if (cell === null) return null;
    if (typeof cell === 'number' && Number.isInteger(cell)) return cell;
    throw new ScanParseError('totals enthaelt einen Wert, der keine ganze Zahl ist.');
  });
}

function readUncertain(
  v: unknown,
  gameCount: number,
  playerCount: number,
): { game: number; player: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { game: number; player: number }[] = [];
  for (const e of v) {
    if (!isObject(e)) continue;
    const game = e['game'];
    const player = e['player'];
    if (
      typeof game === 'number' &&
      typeof player === 'number' &&
      Number.isInteger(game) &&
      Number.isInteger(player) &&
      game >= 0 &&
      game < gameCount &&
      player >= 0 &&
      player < playerCount
    ) {
      out.push({ game, player });
    }
  }
  return out;
}

function readPlayedAt(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (m !== null) {
    // Reines Datum als lokaler Mittag, damit Zeitzonen den Tag nicht verschieben.
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Sucht die Scan-Abschrift im Text: das erste lesbare JSON-Objekt mit
 * `kind: "scan"` (ein Beispiel-Objekt davor wird uebersprungen). Findet sich
 * keines, aber ein Objekt war fehlerhaft oder abgeschnitten, wird genau das
 * gemeldet statt eines irrefuehrenden "kind"-Fehlers.
 */
function extractFirstJsonObject(text: string): Record<string, unknown> | null {
  let firstOther: Record<string, unknown> | null = null;
  let damaged = false;
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const end = findMatchingBrace(text, start);
    if (end === -1) {
      damaged = true;
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1));
      if (isObject(parsed)) {
        if (parsed['kind'] === 'scan') return parsed;
        firstOther ??= parsed;
      }
    } catch {
      damaged = true;
    }
  }
  if (damaged) {
    throw new ScanParseError(
      'Das JSON in der Antwort ist fehlerhaft oder unvollständig (z. B. abgeschnitten oder mit einem Komma am Ende).',
    );
  }
  return firstOther;
}

function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
