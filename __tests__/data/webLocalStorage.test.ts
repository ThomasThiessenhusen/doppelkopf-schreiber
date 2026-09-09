/**
 * `webLocalStorage` gegen ein eingespeistes, in-memory `Storage`-Backend.
 *
 * Der Adapter nimmt sein Backend als Parameter, damit dieser Test ohne jsdom
 * in der node-Umgebung laeuft — und damit derselbe Code in einem Test gegen
 * ein Backend laufen kann, das Fehler wirft.
 */
import { createWebLocalStorage } from '@/data/local/webLocalStorage';

import { runLocalStorageContract } from './localStorageContract';

/** Minimales, vollstaendiges `Storage`-Verhalten inklusive Index-Zugriff. */
function createFakeWebStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

runLocalStorageContract('webLocalStorage', () =>
  createWebLocalStorage({ backend: createFakeWebStorage() }),
);

describe('webLocalStorage: Verhalten auf einem geteilten Origin', () => {
  test('Daten ueberleben eine neue Storage-Instanz auf demselben Backend', async () => {
    const backend = createFakeWebStorage();

    await createWebLocalStorage({ backend }).write('sheets', 's1', { id: 's1', title: 'Samstag' });

    // Neue Instanz auf demselben Backend entspricht einem Reload der Seite.
    expect(await createWebLocalStorage({ backend }).readOne('sheets', 's1')).toEqual({
      id: 's1',
      title: 'Samstag',
    });
  });

  test('fremde Keys im selben Backend werden ignoriert', async () => {
    // Unter file:// teilen sich alle lokalen HTML-Dateien einen Origin, also
    // liegen dort moeglicherweise Keys anderer Seiten. readAll darf die weder
    // zurueckgeben noch daran scheitern.
    const backend = createFakeWebStorage();
    backend.setItem('irgendeine-andere-app', 'kein JSON');
    backend.setItem('theme', '"dark"');

    const storage = createWebLocalStorage({ backend });
    await storage.write('sheets', 's1', { id: 's1' });

    expect(await storage.readAll('sheets')).toEqual([{ id: 's1' }]);
  });

  test('ein unlesbarer eigener Eintrag killt nicht die ganze Liste', async () => {
    const backend = createFakeWebStorage();
    const storage = createWebLocalStorage({ backend });
    await storage.write('sheets', 'gut', { id: 'gut' });

    // Kaputtes JSON unter einem Key, der zu uns gehoert.
    backend.setItem('bockzettel/sheets/kaputt', '{ das ist kein JSON');

    expect(await storage.readAll('sheets')).toEqual([{ id: 'gut' }]);
    expect(await storage.readOne('sheets', 'kaputt')).toBeNull();
  });
});
