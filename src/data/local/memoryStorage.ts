import type { LocalStorage } from '@/data/local/localStorage';

/**
 * `LocalStorage` rein im Speicher — ohne Persistenz.
 *
 * Zwei Verwendungen:
 *
 * 1. Letzte Rueckfallebene im Web, wenn weder IndexedDB noch `localStorage`
 *    benutzbar sind. Die App bleibt dann bedienbar, verliert die Daten aber
 *    beim Schliessen des Tabs — die Oberflaeche muss das entsprechend
 *    kennzeichnen.
 * 2. Als Storage in Tests. Diese Implementierung war ursprünglich ein
 *    reiner Test-Helfer (`__tests__/data/_inMemoryStorage.ts`), was sie zur
 *    am besten abgedeckten Implementierung dieses Interfaces macht.
 */
export function createMemoryStorage(): LocalStorage {
  const data = new Map<string, Map<string, Record<string, unknown>>>();

  function bucket(collection: string): Map<string, Record<string, unknown>> {
    let b = data.get(collection);
    if (b === undefined) {
      b = new Map();
      data.set(collection, b);
    }
    return b;
  }

  return {
    async readAll(collection) {
      return [...bucket(collection).values()];
    },
    async readOne(collection, id) {
      return bucket(collection).get(id) ?? null;
    },
    async write(collection, id, value) {
      bucket(collection).set(id, value);
    },
    async delete(collection, id) {
      bucket(collection).delete(id);
    },
  };
}
