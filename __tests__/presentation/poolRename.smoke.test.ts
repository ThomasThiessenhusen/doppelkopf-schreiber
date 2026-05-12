import { _overrideRepositoriesForTest, repositories } from '@/application/stores/repositories';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createGameSheet } from '@/domain/models/gameSheet';
import {
  createPlayerLookup,
  resolveSheetPlayers,
} from '@/domain/models/playerLookup';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { createInMemoryStorage } from '../data/_inMemoryStorage';

beforeEach(() => {
  const storage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage,
    player: createLocalPlayerRepository(storage),
    gameSheet: createLocalGameSheetRepository(storage),
  });
});

test('renaming a pool player surfaces in resolved sheet players', async () => {
  await repositories.player().save({
    id: 'a',
    playerName: 'Anna',
    firstName: null,
    lastName: null,
  });
  await repositories.player().save({
    id: 'b',
    playerName: 'Ben',
    firstName: null,
    lastName: null,
  });
  await repositories.player().save({
    id: 'c',
    playerName: 'Carla',
    firstName: null,
    lastName: null,
  });
  await repositories.player().save({
    id: 'd',
    playerName: 'Dirk',
    firstName: null,
    lastName: null,
  });
  await usePlayerListStore.getState().refresh();

  const sheet = createGameSheet({
    players: [
      { id: 'a', playerName: 'Anna', firstName: null, lastName: null },
      { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
      { id: 'c', playerName: 'Carla', firstName: null, lastName: null },
      { id: 'd', playerName: 'Dirk', firstName: null, lastName: null },
    ],
  });
  await repositories.gameSheet().save(sheet);

  await usePlayerListStore.getState().update({
    id: 'a',
    playerName: 'Anna-Renamed',
    firstName: null,
    lastName: null,
  });

  const pool = usePlayerListStore.getState().players;
  const lookup = createPlayerLookup(pool);
  const resolved = resolveSheetPlayers(sheet, lookup);
  expect(resolved.map((p) => p.playerName)).toEqual([
    'Anna-Renamed',
    'Ben',
    'Carla',
    'Dirk',
  ]);
});
