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
