import * as FileSystem from 'expo-file-system/legacy';

import type { LocalStorage } from '@/data/local/localStorage';
import { createPerKeyLock } from '@/data/local/perKeyLock';

/**
 * Einfache, robuste Persistenz: pro Datensatz eine JSON-Datei in einem
 * Unterverzeichnis im App-Documents-Pfad.
 *
 * Vorteile fuer dieses Projekt:
 * - keine native Abhaengigkeit ueber `expo-file-system` hinaus
 * - jeder Spielbogen ist als Datei einzeln versioniert/exportierbar
 * - in der Entwicklung leicht inspizierbar (USB-Debugging-Bridge / Simulator)
 *
 * Schreibvorgaenge gehen ueber eine temporaere Datei + move, damit ein Crash
 * mitten im Schreiben keine korrupten Dateien hinterlaesst.
 *
 * `rootOverride` ist optional fuer Tests, die gegen einen Tmp-Pfad arbeiten
 * wollen statt gegen das App-Documents-Verzeichnis.
 */
export interface CreateJsonFileStorageOptions {
  rootOverride?: string;
}

export function createJsonFileStorage(opts: CreateJsonFileStorageOptions = {}): LocalStorage {
  const baseDir =
    opts.rootOverride !== undefined
      ? ensureTrailingSlash(opts.rootOverride)
      : `${FileSystem.documentDirectory ?? ''}doppelkopf_schreiber/`;

  const lock = createPerKeyLock();

  async function ensureDir(path: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
    }
  }

  async function collectionDir(collection: string): Promise<string> {
    await ensureDir(baseDir);
    const dir = `${baseDir}${collection}/`;
    await ensureDir(dir);
    return dir;
  }

  function fileFor(dir: string, id: string): string {
    return `${dir}${id}.json`;
  }

  return {
    async readAll(collection) {
      const dir = await collectionDir(collection);
      const names = await FileSystem.readDirectoryAsync(dir);
      const results: Record<string, unknown>[] = [];
      for (const name of names) {
        if (!name.endsWith('.json')) continue;
        try {
          const raw = await FileSystem.readAsStringAsync(`${dir}${name}`);
          const decoded = JSON.parse(raw) as unknown;
          if (isObject(decoded)) results.push(decoded);
        } catch {
          // Beschaedigte oder verschwundene Datei ueberspringen — ein einzelner
          // fehlerhafter Eintrag soll nicht die ganze Liste killen.
        }
      }
      return results;
    },

    async readOne(collection, id) {
      const dir = await collectionDir(collection);
      const path = fileFor(dir, id);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      try {
        const raw = await FileSystem.readAsStringAsync(path);
        const decoded = JSON.parse(raw) as unknown;
        return isObject(decoded) ? decoded : null;
      } catch (e) {
        if (e instanceof SyntaxError) return null;
        throw e;
      }
    },

    async write(collection, id, data) {
      return lock.run(`${collection}/${id}`, async () => {
        const dir = await collectionDir(collection);
        const path = fileFor(dir, id);
        const tmp = `${path}.tmp`;
        await FileSystem.writeAsStringAsync(tmp, JSON.stringify(data, null, 2));
        await FileSystem.moveAsync({ from: tmp, to: path });
      });
    },

    async delete(collection, id) {
      return lock.run(`${collection}/${id}`, async () => {
        const dir = await collectionDir(collection);
        const path = fileFor(dir, id);
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      });
    },
  };
}

function ensureTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : `${p}/`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
