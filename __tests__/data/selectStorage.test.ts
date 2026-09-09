/**
 * Auswahl-Logik fuer den Web-Storage.
 *
 * Der Kern ist der Timeout: IndexedDB *wirft* auf einem opaken Origin nicht
 * zwingend, sondern kann einfach nie zurueckrufen. Ein `try/catch` wuerde
 * dort ewig warten, statt auf die naechste Ebene zu wechseln. Genau dieses
 * Verhalten deckt `ueberspringt einen Kandidaten, der haengt` ab.
 */
import type { LocalStorage } from '@/data/local/localStorage';
import { selectStorage } from '@/data/local/selectStorage';

/** Unterscheidbare Storage-Attrappe — der Test prueft nur, welche gewaehlt wurde. */
function markiert(marke: string): LocalStorage {
  return {
    async readAll() {
      return [{ marke }];
    },
    async readOne() {
      return { marke };
    },
    async write() {},
    async delete() {},
  };
}

async function markeVon(storage: LocalStorage): Promise<unknown> {
  const row = await storage.readOne('x', 'y');
  return row === null ? null : row.marke;
}

describe('selectStorage', () => {
  test('nimmt den ersten Kandidaten, wenn er sich oeffnen laesst', async () => {
    const gewaehlt = await selectStorage([
      { name: 'erster', open: async () => markiert('erster') },
      { name: 'zweiter', open: async () => markiert('zweiter') },
    ]);

    expect(gewaehlt.name).toBe('erster');
    expect(await markeVon(gewaehlt.storage)).toBe('erster');
  });

  test('spaetere Kandidaten werden nicht geoeffnet, wenn ein frueherer klappt', async () => {
    let zweiterVersucht = false;

    await selectStorage([
      { name: 'erster', open: async () => markiert('erster') },
      {
        name: 'zweiter',
        open: async () => {
          zweiterVersucht = true;
          return markiert('zweiter');
        },
      },
    ]);

    expect(zweiterVersucht).toBe(false);
  });

  test('ueberspringt einen Kandidaten, der einen Fehler wirft', async () => {
    const gewaehlt = await selectStorage([
      {
        name: 'kaputt',
        open: async () => {
          throw new Error('nicht verfuegbar');
        },
      },
      { name: 'ersatz', open: async () => markiert('ersatz') },
    ]);

    expect(gewaehlt.name).toBe('ersatz');
  });

  test('ueberspringt einen Kandidaten, der haengt', async () => {
    const gewaehlt = await selectStorage(
      [
        // Genau der IndexedDB-Fall auf einem opaken Origin: kein Fehler,
        // nur Stille.
        { name: 'haengt', open: () => new Promise<LocalStorage>(() => {}) },
        { name: 'ersatz', open: async () => markiert('ersatz') },
      ],
      { timeoutMs: 30 },
    );

    expect(gewaehlt.name).toBe('ersatz');
  });

  test('faellt bis zum letzten Kandidaten durch', async () => {
    const gewaehlt = await selectStorage(
      [
        { name: 'haengt', open: () => new Promise<LocalStorage>(() => {}) },
        {
          name: 'wirft',
          open: async () => {
            throw new Error('nein');
          },
        },
        { name: 'letzter', open: async () => markiert('letzter') },
      ],
      { timeoutMs: 30 },
    );

    expect(gewaehlt.name).toBe('letzter');
  });

  test('wirft einen sprechenden Fehler, wenn kein Kandidat uebrig bleibt', async () => {
    await expect(
      selectStorage(
        [
          {
            name: 'wirft',
            open: async () => {
              throw new Error('nein');
            },
          },
        ],
        { timeoutMs: 30 },
      ),
    ).rejects.toThrow(/kein.*Storage/i);
  });

  test('ein haengender Kandidat blockiert nicht laenger als der Timeout', async () => {
    const start = Date.now();

    await selectStorage(
      [
        { name: 'haengt', open: () => new Promise<LocalStorage>(() => {}) },
        { name: 'ersatz', open: async () => markiert('ersatz') },
      ],
      { timeoutMs: 30 },
    );

    // Grosszuegige Obergrenze — es geht nur darum, dass ueberhaupt
    // abgebrochen wird und nicht auf den haengenden Promise gewartet wird.
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
