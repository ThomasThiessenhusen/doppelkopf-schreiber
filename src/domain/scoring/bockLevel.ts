/**
 * Niveau des Bock-Bonus, der einem einzelnen Spiel zugewiesen wird.
 *
 * Bonus geht jeweils an die Sieger-Seite und wird im `scoreCalculator`
 * (kommt in M2d) vor der Solo-Skalierung verbucht.
 *
 * - `none`: Kein Bock-Bonus (0).
 * - `single`: Einfacher Bock — Sieger erhaelt +2.
 * - `double`: Doppelbock — Sieger erhaelt +4. Nur im Stapelmodus `doppelbock`
 *   erreichbar, wenn mindestens zwei Bockrunden parallel laufen.
 */
export type BockLevel = 'none' | 'single' | 'double';

export const BockLevel = {
  none: 'none' as const,
  single: 'single' as const,
  double: 'double' as const,
};

const BONUS: Readonly<Record<BockLevel, number>> = {
  none: 0,
  single: 2,
  double: 4,
};

export function bockLevelBonus(level: BockLevel): number {
  return BONUS[level];
}
