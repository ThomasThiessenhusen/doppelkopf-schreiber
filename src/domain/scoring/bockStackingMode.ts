/**
 * Verhalten beim Aneinanderhaengen mehrerer Bockrunden.
 *
 * - `sequential`: laufende Bockrunden zaehlen unsichtbar parallel runter;
 *   solange mindestens eine aktiv ist, gilt einfacher Bock.
 * - `doppelbock`: bei zwei oder mehr parallel aktiven Bockrunden gilt
 *   Doppelbock.
 */
export type BockStackingMode = 'sequential' | 'doppelbock';

export const BockStackingMode = {
  sequential: 'sequential' as const,
  doppelbock: 'doppelbock' as const,
};

const ALL: ReadonlyArray<BockStackingMode> = ['sequential', 'doppelbock'];

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
