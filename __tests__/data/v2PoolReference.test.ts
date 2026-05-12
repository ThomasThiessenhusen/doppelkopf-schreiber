import { runV2Migration } from '@/data/migrations/v2PoolReference';
import type { LocalStorage } from '@/data/local/localStorage';
import { createInMemoryStorage } from './_inMemoryStorage';

function legacySheet(id: string, players: ReadonlyArray<{ id: string; playerName: string }>) {
  return {
    id,
    title: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    players: players.map((p) => ({ ...p, firstName: null, lastName: null })),
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}

describe('runV2Migration', () => {
  test('converts legacy sheet, adds missing pool entries, sets flag', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a', playerName: 'Anna' },
      { id: 'b', playerName: 'Ben' },
    ]));

    await runV2Migration(storage);

    const sheet = await storage.readOne('game_sheets', 's1');
    expect(sheet).toMatchObject({ playerIds: ['a', 'b'] });
    expect(sheet).not.toHaveProperty('players');

    const anna = await storage.readOne('players', 'a');
    expect(anna).toMatchObject({ id: 'a', playerName: 'Anna' });

    const flag = await storage.readOne('_migration', 'schema_v2');
    expect(flag).not.toBeNull();
  });

  test('keeps existing pool entries; only fills the missing ones', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('players', 'a', { id: 'a', playerName: 'AnnaPool' });
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a', playerName: 'AnnaSnapshot' },
      { id: 'b', playerName: 'Ben' },
    ]));

    await runV2Migration(storage);

    const annaAfter = await storage.readOne('players', 'a');
    expect(annaAfter).toMatchObject({ playerName: 'AnnaPool' });
    const benAfter = await storage.readOne('players', 'b');
    expect(benAfter).toMatchObject({ playerName: 'Ben' });
  });

  test('is idempotent', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a', playerName: 'Anna' },
    ]));
    await runV2Migration(storage);
    const first = await storage.readOne('game_sheets', 's1');

    await runV2Migration(storage);
    const second = await storage.readOne('game_sheets', 's1');

    expect(second).toEqual(first);
  });

  test('different ids with same name end up as two pool entries', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', legacySheet('s1', [
      { id: 'a1', playerName: 'Anna' },
    ]));
    await storage.write('game_sheets', 's2', legacySheet('s2', [
      { id: 'a2', playerName: 'Anna' },
    ]));

    await runV2Migration(storage);

    const all = await storage.readAll('players');
    expect(all).toHaveLength(2);
    expect(all.map((p) => p['id']).sort()).toEqual(['a1', 'a2']);
  });

  test('already-migrated sheet (playerIds present) is left alone', async () => {
    const storage: LocalStorage = createInMemoryStorage();
    await storage.write('game_sheets', 's1', {
      id: 's1',
      title: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      playerIds: ['a'],
      rounds: [],
      dirty: false,
      stackingModeOverride: null,
      groupId: null,
    });

    await runV2Migration(storage);

    const after = await storage.readOne('game_sheets', 's1');
    expect(after).toMatchObject({ playerIds: ['a'] });
  });
});
