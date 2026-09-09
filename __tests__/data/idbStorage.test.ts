/**
 * `idbStorage` gegen eine echte IndexedDB-Implementierung (fake-indexeddb),
 * nicht gegen Mocks — der Adapter ist duenn, der Wert liegt genau darin, dass
 * die IndexedDB-Semantik (Transaktionen, Key-Ranges) korrekt bedient wird.
 *
 * `fake-indexeddb/auto` setzt die globalen IndexedDB-Symbole und laeuft in der
 * node-Testumgebung, deshalb braucht diese Datei kein jsdom.
 */
import 'fake-indexeddb/auto';

import { createIdbStorage } from '@/data/local/idbStorage';

import { runLocalStorageContract } from './localStorageContract';

let counter = 0;

runLocalStorageContract('idbStorage', () =>
  // Frische Datenbank pro Test, damit sich Tests nicht ueber gemeinsamen
  // IndexedDB-State beeinflussen.
  createIdbStorage({ databaseName: `bockzettel-test-${++counter}` }),
);

describe('idbStorage: IndexedDB-spezifisches Verhalten', () => {
  test('Daten ueberleben eine neue Storage-Instanz auf derselben Datenbank', async () => {
    const databaseName = `bockzettel-persist-${++counter}`;

    const ersteInstanz = createIdbStorage({ databaseName });
    await ersteInstanz.write('sheets', 's1', { id: 's1', title: 'Donnerstag' });

    // Neue Instanz, gleiche Datenbank: so verhaelt sich ein Reload der Seite.
    const zweiteInstanz = createIdbStorage({ databaseName });
    expect(await zweiteInstanz.readOne('sheets', 's1')).toEqual({
      id: 's1',
      title: 'Donnerstag',
    });
  });

  test('parallele Writes auf dieselbe ID enden in einem konsistenten Zustand', async () => {
    const storage = createIdbStorage({ databaseName: `bockzettel-parallel-${++counter}` });

    await Promise.all([
      storage.write('sheets', 's1', { id: 's1', v: 1 }),
      storage.write('sheets', 's1', { id: 's1', v: 2 }),
      storage.write('sheets', 's1', { id: 's1', v: 3 }),
    ]);

    const gelesen = await storage.readOne('sheets', 's1');
    expect(gelesen).not.toBeNull();
    expect([1, 2, 3]).toContain((gelesen as { v: number }).v);
    expect(await storage.readAll('sheets')).toHaveLength(1);
  });
});
