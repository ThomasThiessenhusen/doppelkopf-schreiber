import type { PersistenceResult } from '@/data/local/requestPersistence';

export type { PersistenceResult };

/**
 * Web-Variante: bittet den Browser, die Daten dieser Origin nicht mehr
 * unter Speicherdruck zu verwerfen.
 *
 * Das ist eine Abmilderung, keine Zusage — der ehrliche Rueckhalt bleibt
 * der JSON-Export. Entsprechend ist der Rueckgabewert reine Information;
 * kein Aufrufer darf sein Verhalten davon abhaengig machen.
 *
 * Der `StorageManager` kommt als Parameter herein, damit der Test kein
 * Global ueberschreiben muss. In Node ist `navigator` seit v21 ein Getter
 * ohne Setter, ein Test mit echtem Global waere also Gefummel.
 */
export async function requestPersistence(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<PersistenceResult> {
  if (typeof storage?.persisted !== 'function' || typeof storage.persist !== 'function') {
    return 'unsupported';
  }
  try {
    // Erst fragen, dann bitten: ist die Origin schon im Bucket, wuerde ein
    // erneutes `persist()` in manchen Browsern eine Nachfrage ausloesen.
    if (await storage.persisted()) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    // Auf einer opaken Origin (`file://`) wirft der Zugriff, statt `false`
    // zu liefern. Fuer den Aufrufer ist das dasselbe wie "gibt es nicht".
    return 'unsupported';
  }
}
