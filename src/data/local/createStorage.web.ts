import { createIdbStorage } from '@/data/local/idbStorage';
import type { LocalStorage } from '@/data/local/localStorage';
import { createMemoryStorage } from '@/data/local/memoryStorage';
import {
  selectStorage,
  type SelectedStorage,
  type StorageCandidate,
} from '@/data/local/selectStorage';
import { createWebLocalStorage } from '@/data/local/webLocalStorage';

/**
 * Web-Variante von `createStorage` — Metro loest diese Datei ueber das
 * `.web`-Suffix automatisch fuer das Web-Target auf.
 *
 * Die Reihenfolge ist absteigend nach Qualitaet:
 *
 * 1. **IndexedDB** — gehostete Variante. Grosses Kontingent, asynchron.
 * 2. **localStorage** — `file://`-Variante. Nachgemessen: funktioniert dort
 *    und ueberlebt sogar einen Browser-Neustart.
 * 3. **Memory** — letzte Reserve. App bleibt bedienbar, Daten sind beim
 *    Schliessen des Tabs weg.
 *
 * Entscheidend: jeder Kandidat wird mit einem **echten Lesezugriff** geprueft,
 * nicht mit `typeof indexedDB !== 'undefined'`. Auf einem aus dem
 * Dateisystem geoeffneten Dokument *existiert* `indexedDB` naemlich, der
 * `open`-Request kann aber schlicht nie zurueckrufen. Nur ein echter Zugriff
 * plus der Timeout in `selectStorage` faengt das.
 */
const PROBE_COLLECTION = '__probe';

let auswahl: Promise<SelectedStorage> | null = null;

function kandidaten(): StorageCandidate[] {
  return [
    {
      name: 'indexeddb',
      open: async () => {
        const storage = createIdbStorage();
        // Erzwingt ein echtes `open` — ein blosser Existenz-Check wuerde
        // hier luegen.
        await storage.readOne(PROBE_COLLECTION, PROBE_COLLECTION);
        return storage;
      },
    },
    {
      name: 'localstorage',
      open: async () => {
        // Der Zugriff auf `localStorage` selbst kann werfen, wenn der
        // Browser Website-Daten sperrt. Das landet als Rejection hier und
        // gilt damit als "nicht benutzbar".
        const storage = createWebLocalStorage();
        await storage.readOne(PROBE_COLLECTION, PROBE_COLLECTION);
        return storage;
      },
    },
    {
      name: 'memory',
      open: async () => createMemoryStorage(),
    },
  ];
}

function ready(): Promise<SelectedStorage> {
  if (auswahl === null) auswahl = selectStorage(kandidaten());
  return auswahl;
}

/**
 * Welche Ebene tatsaechlich gewonnen hat: `'indexeddb'`, `'localstorage'`
 * oder `'memory'`. Die Oberflaeche kann damit im Memory-Fall warnen, dass
 * die Daten den Tab nicht ueberleben.
 */
export function storageMode(): Promise<string> {
  return ready().then((gewaehlt) => gewaehlt.name);
}

/**
 * Liefert **synchron** einen `LocalStorage`, dessen Methoden intern auf die
 * Auswahl warten. So bleibt `repositories.ts` unveraendert dabei, seine
 * Singletons beim Import aufzubauen.
 */
export function createStorage(): LocalStorage {
  return {
    async readAll(collection) {
      return (await ready()).storage.readAll(collection);
    },
    async readOne(collection, id) {
      return (await ready()).storage.readOne(collection, id);
    },
    async write(collection, id, data) {
      return (await ready()).storage.write(collection, id, data);
    },
    async delete(collection, id) {
      return (await ready()).storage.delete(collection, id);
    },
  };
}
