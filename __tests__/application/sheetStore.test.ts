import {
  _overrideRepositoriesForTest,
  repositories,
} from '@/application/stores/repositories';
import { useSheetStore } from '@/application/stores/sheetStore';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createLocalSettingsRepository } from '@/data/repositories/settingsRepository';
import { createLocalSheetGroupRepository } from '@/data/repositories/sheetGroupRepository';
import { createGameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { createInMemoryStorage } from '../data/_inMemoryStorage';

const players: Player[] = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  playerName: id,
  firstName: null,
  lastName: null,
}));

beforeEach(async () => {
  const storage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage,
    player: createLocalPlayerRepository(storage),
    gameSheet: createLocalGameSheetRepository(storage),
    sheetGroup: createLocalSheetGroupRepository(storage),
    settings: createLocalSettingsRepository(storage),
  });
  const sheet = { ...createGameSheet({ players }), id: 'sh' };
  await repositories.gameSheet().save(sheet);
  await useSheetStore.getState().load('sh');
});

describe('sheetStore.setPlayedAt', () => {
  test('speichert das Spieldatum, createdAt bleibt', async () => {
    const before = useSheetStore.getState().state;
    if (before.status !== 'data') throw new Error('Bogen nicht geladen');
    const played = new Date('2026-05-20T19:00:00.000Z');
    await useSheetStore.getState().setPlayedAt(played);
    const stored = await repositories.gameSheet().load('sh');
    expect(stored?.playedAt).toEqual(played);
    expect(stored?.createdAt).toEqual(before.value.createdAt);
  });
});

describe('sheetStore.setSubstitutions', () => {
  test('speichert gueltige Vertretungen', async () => {
    await useSheetStore.getState().setSubstitutions([{ substituteId: 'd', mainPlayerId: 'x' }]);
    const stored = await repositories.gameSheet().load('sh');
    expect(stored?.substitutions).toEqual([{ substituteId: 'd', mainPlayerId: 'x' }]);
  });

  test('wirft bei ungueltigen Vertretungen und speichert nichts', async () => {
    await expect(
      useSheetStore.getState().setSubstitutions([{ substituteId: 'd', mainPlayerId: 'a' }]),
    ).rejects.toThrow();
    const stored = await repositories.gameSheet().load('sh');
    expect(stored?.substitutions).toEqual([]);
  });
});
