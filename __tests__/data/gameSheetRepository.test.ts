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
