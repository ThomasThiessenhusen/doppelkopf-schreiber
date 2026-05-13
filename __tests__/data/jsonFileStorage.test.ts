/**
 * Integrationstest fuer `jsonFileStorage` mit einem in-memory Mock von
 * `expo-file-system/legacy`. Verifiziert insbesondere, dass konkurrierende
 * Writes auf dieselbe Collection+ID serialisiert werden (Per-Key-Lock) und
 * dass parallele Writes auf unterschiedliche IDs sich nicht ueber den
 * Tmp-Pfad in die Quere kommen.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { createJsonFileStorage } from '@/data/local/jsonFileStorage';

interface MockFs {
  files: Map<string, string>;
  ops: string[];
}

jest.mock('expo-file-system/legacy', () => {
  const files = new Map<string, string>();
  const ops: string[] = [];

  return {
    documentDirectory: '/root/',
    __state: { files, ops },

    async getInfoAsync(path: string) {
      if (path.endsWith('/')) {
        for (const p of files.keys()) {
          if (p.startsWith(path)) return { exists: true, isDirectory: true };
        }
        return { exists: false, isDirectory: false };
      }
      return { exists: files.has(path), isDirectory: false };
    },

    async makeDirectoryAsync(_path: string, _opts?: unknown) {
      // Verzeichnisse sind im Mock implizit.
    },

    async readDirectoryAsync(dir: string) {
      const items = new Set<string>();
      for (const p of files.keys()) {
        if (p.startsWith(dir)) {
          const rest = p.slice(dir.length);
          const slash = rest.indexOf('/');
          items.add(slash >= 0 ? rest.slice(0, slash) : rest);
        }
      }
      return [...items];
    },

    async readAsStringAsync(path: string) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    },

    async writeAsStringAsync(path: string, data: string) {
      // Simuliere I/O-Latenz, damit Race-Effekte ueberhaupt sichtbar wuerden.
      await new Promise((r) => setTimeout(r, 5));
      ops.push(`write ${path}`);
      files.set(path, data);
    },

    async moveAsync({ from, to }: { from: string; to: string }) {
      await new Promise((r) => setTimeout(r, 5));
      const v = files.get(from);
      if (v === undefined) throw new Error(`move source missing: ${from}`);
      files.delete(from);
      files.set(to, v);
      ops.push(`move ${from} -> ${to}`);
    },

    async deleteAsync(path: string, _opts?: { idempotent?: boolean }) {
      files.delete(path);
      ops.push(`delete ${path}`);
    },
  };
});

function fsState(): MockFs {
  return (FileSystem as unknown as { __state: MockFs }).__state;
}

beforeEach(() => {
  const s = fsState();
  s.files.clear();
  s.ops.length = 0;
});

describe('jsonFileStorage (mit Mock-FS)', () => {
  test('write + readOne Roundtrip', async () => {
    const storage = createJsonFileStorage({ rootOverride: '/root/' });
    await storage.write('sheets', 's1', { id: 's1', name: 'A' });
    const restored = await storage.readOne('sheets', 's1');
    expect(restored).toEqual({ id: 's1', name: 'A' });
  });

  test('readAll ignoriert Tmp-Dateien und filtert Crash-Leichen', async () => {
    const s = fsState();
    s.files.set('/root/sheets/leftover.123.tmp', '{"id":"leftover"}');
    const storage = createJsonFileStorage({ rootOverride: '/root/' });
    await storage.write('sheets', 's1', { id: 's1' });
    const all = await storage.readAll('sheets');
    expect(all).toEqual([{ id: 's1' }]);
  });

  test('parallele Writes auf dieselbe ID resultieren in einem konsistenten Endzustand', async () => {
    const storage = createJsonFileStorage({ rootOverride: '/root/' });

    // 5 parallele Writes auf dieselbe ID. Ohne Mutex+eindeutige Tmp-Pfade
    // wuerden die internen `<id>.json.tmp`-Writes sich ueberholen und das
    // `moveAsync` waere nicht zwingend die letzte Operation.
    await Promise.all([
      storage.write('sheets', 's1', { v: 1 }),
      storage.write('sheets', 's1', { v: 2 }),
      storage.write('sheets', 's1', { v: 3 }),
      storage.write('sheets', 's1', { v: 4 }),
      storage.write('sheets', 's1', { v: 5 }),
    ]);

    const restored = await storage.readOne('sheets', 's1');
    // Letzter Write gewinnt (deterministisch durch FIFO-Mutex).
    expect(restored).toEqual({ v: 5 });

    // Keine Tmp-Leichen uebrig.
    const s = fsState();
    const tmpFiles = [...s.files.keys()].filter((p) => p.endsWith('.tmp'));
    expect(tmpFiles).toEqual([]);
  });

  test('parallele Writes auf unterschiedliche IDs verwenden eindeutige Tmp-Pfade', async () => {
    const storage = createJsonFileStorage({ rootOverride: '/root/' });

    await Promise.all([
      storage.write('sheets', 'a', { id: 'a' }),
      storage.write('sheets', 'b', { id: 'b' }),
      storage.write('sheets', 'c', { id: 'c' }),
    ]);

    expect(await storage.readOne('sheets', 'a')).toEqual({ id: 'a' });
    expect(await storage.readOne('sheets', 'b')).toEqual({ id: 'b' });
    expect(await storage.readOne('sheets', 'c')).toEqual({ id: 'c' });
  });

  test('write nach delete fuer dieselbe ID wird korrekt serialisiert', async () => {
    const storage = createJsonFileStorage({ rootOverride: '/root/' });
    await storage.write('sheets', 's1', { v: 1 });

    await Promise.all([storage.delete('sheets', 's1'), storage.write('sheets', 's1', { v: 2 })]);

    // delete kam zuerst aus dem Lock-Queue (FIFO), danach write — Endzustand
    // ist der zweite Write.
    expect(await storage.readOne('sheets', 's1')).toEqual({ v: 2 });
  });
});
