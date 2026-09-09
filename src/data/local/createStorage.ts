import { createJsonFileStorage } from '@/data/local/jsonFileStorage';
import type { LocalStorage } from '@/data/local/localStorage';

/**
 * Native Variante: eine JSON-Datei pro Datensatz im App-Documents-Pfad.
 *
 * Das Gegenstueck ist `createStorage.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus, sodass hier kein `Platform.OS`-Zweig noetig ist und
 * die jeweils andere Implementierung nicht im Bundle landet.
 */
export function createStorage(): LocalStorage {
  return createJsonFileStorage();
}

/**
 * Nur zur Symmetrie mit der Web-Variante, damit gemeinsam genutzter Code den
 * Speichermodus abfragen kann, ohne ein web-spezifisches Modul zu importieren.
 * Auf Native ist die Antwort immer dieselbe.
 */
export function storageMode(): Promise<string> {
  return Promise.resolve('file');
}
