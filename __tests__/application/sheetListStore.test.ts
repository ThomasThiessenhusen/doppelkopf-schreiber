import { _overrideRepositoriesForTest } from '@/application/stores/repositories';
import { useSheetListStore } from '@/application/stores/sheetListStore';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createLocalSettingsRepository } from '@/data/repositories/settingsRepository';
import { createLocalSheetGroupRepository } from '@/data/repositories/sheetGroupRepository';
import { copyGameSheet, createGameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { createInMemoryStorage } from '../data/_inMemoryStorage';

const players: Player[] = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  playerName: id,
  firstName: null,
  lastName: null,
}));

function sheetAt(played: string) {
  return createGameSheet({ players, at: new Date(played) });
}

beforeEach(() => {
  const storage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage,
    player: createLocalPlayerRepository(storage),
    gameSheet: createLocalGameSheetRepository(storage),
    sheetGroup: createLocalSheetGroupRepository(storage),
    settings: createLocalSettingsRepository(storage),
  });
  useSheetListStore.setState({ sheets: [], loading: false, error: null });
});

describe('sheetListStore Sortierung nach playedAt', () => {
  test('createSheet ordnet einen nachgetragenen aelteren Bogen hinter neueren ein', async () => {
    const store = useSheetListStore.getState();
    const recent = sheetAt('2026-06-01T19:00:00.000Z');
    const older = sheetAt('2026-03-01T19:00:00.000Z');
    await store.createSheet(recent, players);
    await useSheetListStore.getState().createSheet(older, players);
    expect(useSheetListStore.getState().sheets.map((s) => s.id)).toEqual([recent.id, older.id]);
  });

  test('upsertLocal sortiert neu, wenn playedAt geaendert wird', () => {
    const a = sheetAt('2026-06-01T19:00:00.000Z');
    const b = sheetAt('2026-05-01T19:00:00.000Z');
    useSheetListStore.setState({ sheets: [a, b] });
    const bLater = copyGameSheet(b, { playedAt: new Date('2026-07-01T19:00:00.000Z') });
    useSheetListStore.getState().upsertLocal(bLater);
    expect(useSheetListStore.getState().sheets.map((s) => s.id)).toEqual([b.id, a.id]);
  });

  test('upsertLocal: Bearbeiten eines aelteren Bogens zieht ihn nicht nach oben', () => {
    const a = sheetAt('2026-06-01T19:00:00.000Z');
    const b = sheetAt('2026-05-01T19:00:00.000Z');
    useSheetListStore.setState({ sheets: [a, b] });
    useSheetListStore.getState().upsertLocal(copyGameSheet(b, { title: 'neu' }));
    expect(useSheetListStore.getState().sheets.map((s) => s.id)).toEqual([a.id, b.id]);
  });
});
