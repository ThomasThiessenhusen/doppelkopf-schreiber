/**
 * Verdrahtung des Web-Storages.
 *
 * Die Testumgebung (`testEnvironment: 'node'`) hat weder `indexedDB` noch
 * `localStorage` — nachgemessen, nicht angenommen. Damit ist sie genau der
 * pessimistische Fall: beide Kandidaten scheitern, und die Kette muss bis zur
 * Memory-Ebene durchfallen, *ohne* dass die App dabei stehen bleibt.
 *
 * Der zweite wichtige Punkt ist die Synchronitaet: `repositories.ts` baut
 * seine Singletons beim Import auf. `createStorage()` muss deshalb sofort ein
 * benutzbares Objekt liefern und die Auswahl intern nachziehen.
 */
import { createStorage, storageMode } from '@/data/local/createStorage.web';

describe('createStorage (Web)', () => {
  test('liefert sofort ein benutzbares Objekt, ohne await', () => {
    const storage = createStorage();
    expect(typeof storage.readAll).toBe('function');
    expect(typeof storage.readOne).toBe('function');
    expect(typeof storage.write).toBe('function');
    expect(typeof storage.delete).toBe('function');
  });

  test('faellt ohne IndexedDB und ohne localStorage auf Memory zurueck', async () => {
    await expect(storageMode()).resolves.toBe('memory');
  });

  test('write und readOne funktionieren durch die verzoegerte Auswahl hindurch', async () => {
    const storage = createStorage();
    await storage.write('sheets', 's1', { id: 's1', title: 'Mittwoch' });
    expect(await storage.readOne('sheets', 's1')).toEqual({ id: 's1', title: 'Mittwoch' });
  });

  test('readAll und delete werden ebenfalls durchgereicht', async () => {
    const storage = createStorage();
    await storage.write('players', 'p1', { id: 'p1' });
    expect(await storage.readAll('players')).toEqual([{ id: 'p1' }]);

    await storage.delete('players', 'p1');
    expect(await storage.readAll('players')).toEqual([]);
  });

  test('mehrere Aufrufe teilen sich dieselbe Auswahl und damit dieselben Daten', async () => {
    // Sonst wuerde jeder Store in der App auf einem eigenen Storage arbeiten.
    await createStorage().write('sheets', 'geteilt', { id: 'geteilt' });
    expect(await createStorage().readOne('sheets', 'geteilt')).toEqual({ id: 'geteilt' });
  });
});
