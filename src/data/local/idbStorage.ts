import type { LocalStorage } from '@/data/local/localStorage';

/**
 * `LocalStorage` ueber IndexedDB — die Web-Entsprechung zu
 * `jsonFileStorage`.
 *
 * Modell wie beim Datei-Storage: ein Datensatz pro Key. Statt einer Datei pro
 * Spielbogen liegt jeder Datensatz unter dem Key `<collection>/<id>` in einem
 * einzigen Object-Store. `readAll` ist damit ein Praefix-Scan ueber einen
 * Key-Range und braucht keinen Sekundaer-Index.
 *
 * IndexedDB statt `localStorage`: letzteres ist synchron (blockiert also den
 * UI-Thread bei jedem Schreibvorgang), liegt bei etwa 5 MB und wird von
 * Browsern als erstes verworfen. Fuer die `file://`-Variante, wo IndexedDB
 * nicht zur Verfuegung steht, gibt es `webLocalStorage`.
 *
 * `databaseName` ist fuer Tests gedacht, damit jeder Test gegen eine frische
 * Datenbank laeuft.
 */
const STORE = 'records';
const DEFAULT_DATABASE = 'bockzettel';

export interface CreateIdbStorageOptions {
  databaseName?: string;
}

export function createIdbStorage(opts: CreateIdbStorageOptions = {}): LocalStorage {
  const databaseName = opts.databaseName ?? DEFAULT_DATABASE;
  let opening: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (opening === null) {
      opening = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE)) {
            request.result.createObjectStore(STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfuegbar.'));
        request.onblocked = () => reject(new Error('IndexedDB-Zugriff blockiert.'));
      });
    }
    return opening;
  }

  async function run<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB-Operation fehlgeschlagen.'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB-Transaktion abgebrochen.'));
    });
  }

  function keyFor(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  return {
    async readAll(collection) {
      const praefix = `${collection}/`;
      // '￿' liegt hinter jedem realistischen Key-Zeichen, begrenzt den
      // Scan aber auf genau diese Collection: "sheetGroups/..." sortiert
      // ausserhalb von ["sheet/", "sheet/￿"], weil 'G' > '/'.
      const range = IDBKeyRange.bound(praefix, `${praefix}￿`);
      const rows = await run<unknown[]>('readonly', (store) => store.getAll(range));
      // Ein einzelner kaputter Eintrag soll nicht die ganze Liste killen —
      // gleiches Verhalten wie in jsonFileStorage.
      return rows.filter(isObject);
    },

    async readOne(collection, id) {
      const row = await run<unknown>('readonly', (store) =>
        store.get(keyFor(collection, id)),
      );
      return isObject(row) ? row : null;
    },

    async write(collection, id, data) {
      await run('readwrite', (store) => store.put(data, keyFor(collection, id)));
    },

    async delete(collection, id) {
      await run('readwrite', (store) => store.delete(keyFor(collection, id)));
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
