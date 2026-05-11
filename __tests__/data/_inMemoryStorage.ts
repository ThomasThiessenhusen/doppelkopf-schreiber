import type { LocalStorage } from '@/data/local/localStorage';

/** In-Memory-LocalStorage fuer Repository-Tests. */
export function createInMemoryStorage(): LocalStorage {
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
