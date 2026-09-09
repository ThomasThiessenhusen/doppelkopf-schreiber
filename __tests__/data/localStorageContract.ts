/**
 * Geteilte Vertrags-Suite fuer alle `LocalStorage`-Implementierungen.
 *
 * Jede Implementierung (jsonFileStorage auf Native, idbStorage und
 * webLocalStorage auf Web, memoryStorage als Rueckfallebene) muss sich
 * identisch verhalten — sonst haengt das Verhalten der App davon ab, auf
 * welcher Plattform sie laeuft. Die Suite wird deshalb aus jeder
 * Implementierungs-Testdatei heraus aufgerufen.
 *
 * `factory` muss bei jedem Aufruf einen frischen, leeren Storage liefern.
 */
import type { LocalStorage } from '@/data/local/localStorage';

function byId(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

export function runLocalStorageContract(
  name: string,
  factory: () => LocalStorage | Promise<LocalStorage>,
): void {
  describe(`LocalStorage-Vertrag: ${name}`, () => {
    let storage: LocalStorage;

    beforeEach(async () => {
      storage = await factory();
    });

    test('write, dann readOne liefert denselben Datensatz', async () => {
      await storage.write('sheets', 's1', { id: 's1', title: 'Freitagsrunde' });
      expect(await storage.readOne('sheets', 's1')).toEqual({ id: 's1', title: 'Freitagsrunde' });
    });

    test('write, dann readAll liefert alle Datensaetze der Collection', async () => {
      await storage.write('sheets', 's1', { id: 's1' });
      await storage.write('sheets', 's2', { id: 's2' });
      expect(byId(await storage.readAll('sheets'))).toEqual([{ id: 's1' }, { id: 's2' }]);
    });

    test('zweiter write auf dieselbe ID ersetzt den Datensatz', async () => {
      await storage.write('sheets', 's1', { id: 's1', v: 1 });
      await storage.write('sheets', 's1', { id: 's1', v: 2 });
      expect(await storage.readOne('sheets', 's1')).toEqual({ id: 's1', v: 2 });
      expect(await storage.readAll('sheets')).toHaveLength(1);
    });

    test('delete entfernt den Datensatz', async () => {
      await storage.write('sheets', 's1', { id: 's1' });
      await storage.delete('sheets', 's1');
      expect(await storage.readOne('sheets', 's1')).toBeNull();
      expect(await storage.readAll('sheets')).toEqual([]);
    });

    test('delete einer unbekannten ID wirft nicht', async () => {
      await expect(storage.delete('sheets', 'gibt-es-nicht')).resolves.toBeUndefined();
    });

    test('readOne einer unbekannten ID liefert null', async () => {
      expect(await storage.readOne('sheets', 'gibt-es-nicht')).toBeNull();
    });

    test('readAll einer leeren Collection liefert ein leeres Array', async () => {
      expect(await storage.readAll('sheets')).toEqual([]);
    });

    test('Collections sind voneinander isoliert', async () => {
      await storage.write('sheets', 'gleiche-id', { id: 'gleiche-id', typ: 'sheet' });
      await storage.write('players', 'gleiche-id', { id: 'gleiche-id', typ: 'player' });

      expect(await storage.readOne('sheets', 'gleiche-id')).toEqual({
        id: 'gleiche-id',
        typ: 'sheet',
      });
      expect(await storage.readOne('players', 'gleiche-id')).toEqual({
        id: 'gleiche-id',
        typ: 'player',
      });
      expect(await storage.readAll('sheets')).toHaveLength(1);
      expect(await storage.readAll('players')).toHaveLength(1);
    });

    test('Collection-Namen mit gemeinsamem Praefix vermischen sich nicht', async () => {
      // Wichtig fuer key-basierte Implementierungen: ein Praefix-Scan auf
      // "sheet/" darf "sheetGroups/" nicht mitlesen.
      await storage.write('sheet', 'a', { id: 'a' });
      await storage.write('sheetGroups', 'b', { id: 'b' });

      expect(byId(await storage.readAll('sheet'))).toEqual([{ id: 'a' }]);
      expect(byId(await storage.readAll('sheetGroups'))).toEqual([{ id: 'b' }]);
    });

    test('verschachtelte Werte bleiben ueber einen Roundtrip erhalten', async () => {
      const komplex = {
        id: 's1',
        rounds: [{ index: 0, games: [{ id: 'g1', flagCodes: ['re', 'kontra'] }] }],
        totals: { p1: -3, p2: 3 },
        title: null,
      };
      await storage.write('sheets', 's1', komplex);
      expect(await storage.readOne('sheets', 's1')).toEqual(komplex);
    });
  });
}
