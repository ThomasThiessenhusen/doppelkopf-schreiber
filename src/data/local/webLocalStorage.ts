import type { LocalStorage } from '@/data/local/localStorage';

/**
 * `LocalStorage` ueber die `localStorage`-API des Browsers.
 *
 * Gedacht fuer die `file://`-Variante der App: dort steht IndexedDB nicht
 * verlaesslich zur Verfuegung, `localStorage` dagegen funktioniert und
 * ueberlebt gemessen auch einen Browser-Neustart.
 *
 * Zwei Eigenheiten dieses Umfelds schlagen aufs Design durch:
 *
 * 1. Unter `file://` teilen sich in Chrome *alle* lokalen HTML-Dateien einen
 *    Origin. Deshalb tragen alle Keys das Praefix `bockzettel/`, und `readAll`
 *    ignoriert alles, was nicht dazu passt.
 * 2. Die API ist synchron und auf etwa 5 MB begrenzt. Fuer Spielstaende in
 *    der Groessenordnung einiger KB ist das reichlich; fuer die gehostete
 *    Variante ist `idbStorage` trotzdem die bessere Wahl.
 *
 * `backend` ist einspeisbar, damit Tests ohne jsdom laufen.
 */
const KEY_PREFIX = 'bockzettel/';

export interface CreateWebLocalStorageOptions {
  backend?: Storage;
}

export function createWebLocalStorage(opts: CreateWebLocalStorageOptions = {}): LocalStorage {
  const backend = opts.backend ?? globalThis.localStorage;

  function keyFor(collection: string, id: string): string {
    return `${KEY_PREFIX}${collection}/${id}`;
  }

  function parse(raw: string | null): Record<string, unknown> | null {
    if (raw === null) return null;
    try {
      const decoded = JSON.parse(raw) as unknown;
      return isObject(decoded) ? decoded : null;
    } catch {
      // Kaputter Eintrag — wie in jsonFileStorage ueberspringen statt werfen.
      return null;
    }
  }

  return {
    async readAll(collection) {
      const praefix = `${KEY_PREFIX}${collection}/`;
      // Keys zuerst sammeln, dann lesen: `key(i)` ueber einen sich
      // veraendernden Store zu iterieren waere fragil.
      const keys: string[] = [];
      for (let i = 0; i < backend.length; i++) {
        const key = backend.key(i);
        if (key !== null && key.startsWith(praefix)) keys.push(key);
      }

      const rows: Record<string, unknown>[] = [];
      for (const key of keys) {
        const row = parse(backend.getItem(key));
        if (row !== null) rows.push(row);
      }
      return rows;
    },

    async readOne(collection, id) {
      return parse(backend.getItem(keyFor(collection, id)));
    },

    async write(collection, id, data) {
      backend.setItem(keyFor(collection, id), JSON.stringify(data));
    },

    async delete(collection, id) {
      backend.removeItem(keyFor(collection, id));
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
