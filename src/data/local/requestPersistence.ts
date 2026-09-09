/**
 * Ergebnis der Bitte, den Speicher dauerhaft zu behandeln.
 *
 * `unsupported` heisst nicht "fehlgeschlagen", sondern "die Frage stellt
 * sich hier nicht" — so ist es auf allen nativen Zielen.
 */
export type PersistenceResult = 'granted' | 'denied' | 'unsupported';

/**
 * Native Variante: es gibt nichts zu erbitten. Die App schreibt in ihren
 * eigenen Documents-Pfad, den raeumt das Betriebssystem nicht unter
 * Speicherdruck ab.
 *
 * Das Gegenstueck ist `requestPersistence.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export function requestPersistence(): Promise<PersistenceResult> {
  return Promise.resolve('unsupported');
}
