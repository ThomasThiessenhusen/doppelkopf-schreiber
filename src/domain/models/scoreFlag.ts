/** Beschreibt, welcher Seite ein Score-Flag zugeordnet wird. */
export type FlagTarget = 'winner' | 'loser' | 'reSide' | 'contraSide';

export const FlagTarget = {
  winner: 'winner' as const,
  loser: 'loser' as const,
  reSide: 'reSide' as const,
  contraSide: 'contraSide' as const,
};

/** Gruppierung in der Eingabemaske — rein UI-relevant, kein Punkte-Einfluss. */
export type FlagGroup = 'reParty' | 'contraParty' | 'general';

export const FlagGroup = {
  reParty: 'reParty' as const,
  contraParty: 'contraParty' as const,
  general: 'general' as const,
};

/**
 * Definition eines Punkte-Flags (z. B. "Unter 90", "Karlchen Gewinner").
 *
 * Die App liefert einen festen Katalog von Flags (`ScoringRules.all` in
 * `scoringRules.ts`, kommt in M2d). Spiele speichern lediglich die Codes;
 * das erlaubt spaetere Anpassungen der Punktwerte, ohne historische
 * Spielboegen zu beschaedigen, solange der Code stabil bleibt.
 */
export interface ScoreFlag {
  readonly code: string;
  readonly label: string;
  readonly value: number;
  readonly target: FlagTarget;
  readonly description?: string;
  /** UI-Gruppierung (Re-Partei / Kontra-Partei / allgemein). Default: 'general'. */
  readonly group: FlagGroup;
  /**
   * Wenn true, ist das Flag durch Auswahl der Gewinner-Seite implizit gesetzt
   * und nicht einzeln in der UI auswaehlbar. Default: false.
   */
  readonly isBaseFlag: boolean;
}

export function scoreFlagsEqual(a: ScoreFlag, b: ScoreFlag): boolean {
  return a.code === b.code;
}
