/**
 * Verhalten beim Aneinanderhaengen mehrerer Bockrunden.
 *
 * - `sequential`: laufende Bockrunden zaehlen unsichtbar parallel runter;
 *   solange mindestens eine aktiv ist, gilt einfacher Bock.
 * - `doppelbock`: bei zwei oder mehr parallel aktiven Bockrunden gilt
 *   Doppelbock.
 * - `off`: ohne Bock — Trigger werden ignoriert, kein Spiel erhaelt einen
 *   Bock-Bonus. Die Trigger bleiben im Spiel gespeichert, sodass ein spaeterer
 *   Moduswechsel die Bockrunden wieder korrekt ableitet.
 */
export type BockStackingMode = 'sequential' | 'doppelbock' | 'off';

export const BockStackingMode = {
  sequential: 'sequential' as const,
  doppelbock: 'doppelbock' as const,
  off: 'off' as const,
};

const ALL: readonly BockStackingMode[] = ['sequential', 'doppelbock', 'off'];

export function bockStackingModeToJson(mode: BockStackingMode): string {
  return mode;
}

export function bockStackingModeFromJson(s: string): BockStackingMode {
  const found = ALL.find((m) => m === s);
  if (!found) {
    throw new Error(`Unbekannter BockStackingMode: ${s}`);
  }
  return found;
}
