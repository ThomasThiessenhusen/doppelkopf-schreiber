import { newId } from '@/core/id';

/** Welche Seite das Spiel gewonnen hat. */
export type WinnerSide = 're' | 'contra';

export const WinnerSide = {
  re: 're' as const,
  contra: 'contra' as const,
};

export function winnerSideLabel(w: WinnerSide): string {
  return w === 're' ? 'Re' : 'Kontra';
}

export function winnerSideFromString(s: string): WinnerSide {
  return s === 're' ? 're' : 'contra';
}

export function winnerSideToJson(w: WinnerSide): string {
  return w;
}

/**
 * Ein einzelnes gespieltes Spiel innerhalb einer Runde.
 *
 * Enthaelt nur Rohdaten (Aufstellung, Gewinner, gesetzte Flags). Die
 * Punkteberechnung uebernimmt `scoreCalculator` (kommt in M2d), sodass
 * sich Regeln aendern lassen, ohne gespeicherte Spielboegen zu invalidieren.
 */
export interface Game {
  readonly id: string;
  readonly playedAt: Date;
  readonly rePlayerIds: readonly string[];
  readonly contraPlayerIds: readonly string[];
  /** `null` bei 4-Spieler-Spielen. */
  readonly sittingOutPlayerId: string | null;
  readonly winner: WinnerSide;
  readonly flagCodes: readonly string[];
  readonly note: string | null;
  /**
   * Solo-Spiel: genau ein Spieler bildet die Re-Partei, die uebrigen drei
   * die Kontra-Partei. Der Solist erhaelt den 3-fachen Punktwert (mit
   * Vorzeichen je nach Sieger), jeder Kontra-Spieler den einfachen
   * Gegenwert — die Quersumme bleibt 0.
   */
  readonly isSolo: boolean;
  /** Dieses Spiel loest eine manuell angesagte Bockrunde aus. */
  readonly triggersManualBock: boolean;
  /**
   * Nur bei Punkte-Spielen (von Papier uebernommen): Punkte pro Spieler.
   * Enthaelt nur aktive Spieler; ein Aussetzer steht nur in
   * `sittingOutPlayerId`. Fehlt bei normalen Spielen.
   */
  readonly pointsByPlayerId?: Readonly<Record<string, number>>;
}

/** `true`, wenn das Spiel feste Punkte statt berechneter Punkte traegt. */
export function isPointsGame(g: Game): boolean {
  return g.pointsByPlayerId !== undefined;
}

export interface PointsGameInput {
  pointsByPlayerId: Readonly<Record<string, number>>;
  sittingOutPlayerId?: string | null;
  playedAt?: Date;
}

/**
 * Spiel mit expliziten Punkten pro Spieler (Papier-Import). Loest keine
 * Bockrunde aus und traegt keine Teams oder Flags.
 */
export function createPointsGame(input: PointsGameInput): Game {
  const values = Object.values(input.pointsByPlayerId);
  if (values.length === 0) {
    throw new Error('Punkte-Spiel: mindestens ein Spieler noetig.');
  }
  if (!values.every((v) => Number.isInteger(v))) {
    throw new Error('Punkte-Spiel: Punkte muessen ganze Zahlen sein.');
  }
  if (values.reduce((a, b) => a + b, 0) !== 0) {
    throw new Error('Punkte-Spiel: Quersumme muss 0 sein.');
  }
  return {
    id: newId(),
    playedAt: input.playedAt ?? new Date(),
    rePlayerIds: [],
    contraPlayerIds: [],
    sittingOutPlayerId: input.sittingOutPlayerId ?? null,
    winner: WinnerSide.re,
    flagCodes: [],
    note: null,
    isSolo: false,
    triggersManualBock: false,
    pointsByPlayerId: { ...input.pointsByPlayerId },
  };
}

export interface CreateGameInput {
  rePlayerIds: readonly string[];
  contraPlayerIds: readonly string[];
  winner: WinnerSide;
  flagCodes: readonly string[];
  sittingOutPlayerId?: string | null;
  note?: string | null;
  playedAt?: Date;
  isSolo?: boolean;
  triggersManualBock?: boolean;
}

export function createGame(input: CreateGameInput): Game {
  const isSolo = input.isSolo ?? false;
  const valid = isSolo
    ? input.rePlayerIds.length === 1 && input.contraPlayerIds.length === 3
    : input.rePlayerIds.length === 2 && input.contraPlayerIds.length === 2;
  if (!valid) {
    throw new Error('Aufstellung passt nicht zum Spieltyp: klassisch = 2:2, Solo = 1:3.');
  }
  return {
    id: newId(),
    playedAt: input.playedAt ?? new Date(),
    rePlayerIds: input.rePlayerIds,
    contraPlayerIds: input.contraPlayerIds,
    sittingOutPlayerId: input.sittingOutPlayerId ?? null,
    winner: input.winner,
    flagCodes: input.flagCodes,
    note: input.note ?? null,
    isSolo,
    triggersManualBock: input.triggersManualBock ?? false,
  };
}

export interface GamePatch {
  rePlayerIds?: readonly string[];
  contraPlayerIds?: readonly string[];
  winner?: WinnerSide;
  flagCodes?: readonly string[];
  /** Auslassen = behalten; `null` = clearen; String = setzen. */
  sittingOutPlayerId?: string | null;
  /** Auslassen = behalten; `null` = clearen; String = setzen. */
  note?: string | null;
  isSolo?: boolean;
  triggersManualBock?: boolean;
  /** Nur fuer Punkte-Spiele: ersetzt die Punkte. */
  pointsByPlayerId?: Readonly<Record<string, number>>;
}

export function copyGame(g: Game, patch: GamePatch): Game {
  const pointsByPlayerId = patch.pointsByPlayerId ?? g.pointsByPlayerId;
  return {
    ...(pointsByPlayerId !== undefined ? { pointsByPlayerId } : {}),
    id: g.id,
    playedAt: g.playedAt,
    rePlayerIds: patch.rePlayerIds ?? g.rePlayerIds,
    contraPlayerIds: patch.contraPlayerIds ?? g.contraPlayerIds,
    winner: patch.winner ?? g.winner,
    flagCodes: patch.flagCodes ?? g.flagCodes,
    sittingOutPlayerId:
      'sittingOutPlayerId' in patch ? (patch.sittingOutPlayerId ?? null) : g.sittingOutPlayerId,
    note: 'note' in patch ? (patch.note ?? null) : g.note,
    isSolo: patch.isSolo ?? g.isSolo,
    triggersManualBock: patch.triggersManualBock ?? g.triggersManualBock,
  };
}

export function gameToJson(g: Game): Record<string, unknown> {
  return {
    ...(g.pointsByPlayerId !== undefined ? { pointsByPlayerId: { ...g.pointsByPlayerId } } : {}),
    id: g.id,
    playedAt: g.playedAt.toISOString(),
    rePlayerIds: [...g.rePlayerIds],
    contraPlayerIds: [...g.contraPlayerIds],
    sittingOutPlayerId: g.sittingOutPlayerId,
    winner: winnerSideToJson(g.winner),
    flagCodes: [...g.flagCodes],
    note: g.note,
    isSolo: g.isSolo,
    triggersManualBock: g.triggersManualBock,
  };
}

export function gameFromJson(json: Record<string, unknown>): Game {
  const id = json['id'];
  const playedAt = json['playedAt'];
  const rePlayerIds = json['rePlayerIds'];
  const contraPlayerIds = json['contraPlayerIds'];
  const winner = json['winner'];
  const flagCodes = json['flagCodes'];
  if (typeof id !== 'string') throw new Error('Game.id fehlt');
  if (typeof playedAt !== 'string') throw new Error('Game.playedAt fehlt');
  if (!Array.isArray(rePlayerIds)) throw new Error('Game.rePlayerIds fehlt');
  if (!Array.isArray(contraPlayerIds)) throw new Error('Game.contraPlayerIds fehlt');
  if (typeof winner !== 'string') throw new Error('Game.winner fehlt');
  if (!Array.isArray(flagCodes)) throw new Error('Game.flagCodes fehlt');
  const pointsByPlayerId = readPointsByPlayerId(json['pointsByPlayerId']);
  return {
    ...(pointsByPlayerId !== undefined ? { pointsByPlayerId } : {}),
    id,
    playedAt: new Date(playedAt),
    rePlayerIds: rePlayerIds.map(String),
    contraPlayerIds: contraPlayerIds.map(String),
    sittingOutPlayerId:
      typeof json['sittingOutPlayerId'] === 'string' ? (json['sittingOutPlayerId'] as string) : null,
    winner: winnerSideFromString(winner),
    flagCodes: flagCodes.map(String),
    note: typeof json['note'] === 'string' ? (json['note'] as string) : null,
    isSolo: json['isSolo'] === true,
    triggersManualBock: json['triggersManualBock'] === true,
  };
}

/** Liest die Punkte-Map; ungueltige Formen werden ignoriert (normales Spiel). */
function readPointsByPlayerId(v: unknown): Record<string, number> | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== 'number' || !Number.isInteger(val)) return undefined;
    out[k] = val;
  }
  return out;
}
