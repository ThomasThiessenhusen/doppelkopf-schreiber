/**
 * Wie dringend die Oberflaeche ueber den gewaehlten Speicher reden muss.
 *
 * - `none` — der Speicher ueberlebt den Neustart, es gibt nichts zu sagen.
 * - `info` — er haelt, hat aber Grenzen, die man kennen sollte.
 * - `warning` — die Daten sind mit dem Tab weg.
 */
export type StorageNotice = 'none' | 'info' | 'warning';

/**
 * Bildet den Rueckgabewert von `storageMode()` auf die Dringlichkeit ab.
 *
 * Bewusst plattform-neutral und ohne UI-Bezug: die Entscheidung, *was*
 * gesagt wird, gehoert in die Praesentationsschicht, die Entscheidung *wie
 * laut* hierher.
 */
export function storageNotice(mode: string): StorageNotice {
  switch (mode) {
    case 'file':
    case 'indexeddb':
      return 'none';
    case 'memory':
      return 'warning';
    // Ein unbekannter Modus ist kein Grund zu warnen, aber einer, ihn zu
    // benennen — sonst verschweigt die App stillschweigend, wo die Daten
    // liegen.
    default:
      return 'info';
  }
}
