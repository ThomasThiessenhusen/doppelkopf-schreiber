import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createInMemoryStorage } from './_inMemoryStorage';

describe('gameSheetRepository.loadAll', () => {
  test('skips corrupt sheets instead of failing the whole load', async () => {
    const storage = createInMemoryStorage();
    // Valides Sheet
    await storage.write('game_sheets', 'good', {
      id: 'good',
      title: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      playerIds: ['a', 'b', 'c', 'd'],
      rounds: [],
      dirty: false,
      stackingModeOverride: null,
      groupId: null,
    });
    // Korruptes Sheet: 3 playerIds (verstoesst gegen Length-Check)
    await storage.write('game_sheets', 'bad', {
      id: 'bad',
      title: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      playerIds: ['a', 'b', 'c'],
      rounds: [],
      dirty: false,
      stackingModeOverride: null,
      groupId: null,
    });
    const repo = createLocalGameSheetRepository(storage);
    const sheets = await repo.loadAll();
    expect(sheets.map((s) => s.id)).toEqual(['good']);
  });
});

describe('gameSheetRepository.loadAll Sortierung', () => {
  function raw(id: string, playedAt: string, updatedAt: string) {
    return {
      id,
      title: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      playedAt,
      updatedAt,
      playerIds: ['a', 'b', 'c', 'd'],
      rounds: [],
      dirty: false,
      stackingModeOverride: null,
      groupId: null,
    };
  }

  test('sortiert absteigend nach playedAt, nicht nach updatedAt', async () => {
    const storage = createInMemoryStorage();
    await storage.write('game_sheets', 'alt', raw('alt', '2026-03-01T19:00:00.000Z', '2026-09-01T00:00:00.000Z'));
    await storage.write('game_sheets', 'neu', raw('neu', '2026-05-01T19:00:00.000Z', '2026-05-02T00:00:00.000Z'));
    await storage.write('game_sheets', 'mitte', raw('mitte', '2026-04-01T19:00:00.000Z', '2026-04-02T00:00:00.000Z'));
    const sheets = await createLocalGameSheetRepository(storage).loadAll();
    expect(sheets.map((s) => s.id)).toEqual(['neu', 'mitte', 'alt']);
  });

  test('bei gleichem playedAt entscheidet updatedAt (neuere zuerst)', async () => {
    const storage = createInMemoryStorage();
    await storage.write('game_sheets', 'x', raw('x', '2026-05-01T19:00:00.000Z', '2026-05-02T00:00:00.000Z'));
    await storage.write('game_sheets', 'y', raw('y', '2026-05-01T19:00:00.000Z', '2026-05-03T00:00:00.000Z'));
    const sheets = await createLocalGameSheetRepository(storage).loadAll();
    expect(sheets.map((s) => s.id)).toEqual(['y', 'x']);
  });
});
