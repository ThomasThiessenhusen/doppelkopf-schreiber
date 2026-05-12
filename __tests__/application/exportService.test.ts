import {
  _overrideRepositoriesForTest,
  repositories,
} from '@/application/stores/repositories';
import {
  exportBackup,
  exportGroup,
  exportSheet,
} from '@/application/export/exportService';
import { APP_TAG, FORMAT_VERSION } from '@/application/export/exportTypes';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createLocalSettingsRepository } from '@/data/repositories/settingsRepository';
import { createLocalSheetGroupRepository } from '@/data/repositories/sheetGroupRepository';
import type { GameSheet } from '@/domain/models/gameSheet';
import { GroupType } from '@/domain/models/groupType';
import type { Player } from '@/domain/models/player';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { createInMemoryStorage } from '../data/_inMemoryStorage';

const now = new Date('2026-05-12T15:00:00.000Z');

function p(id: string, name: string): Player {
  return { id, playerName: name, firstName: null, lastName: null };
}

function s(
  id: string,
  playerIds: ReadonlyArray<string>,
  groupId: string | null = null,
): GameSheet {
  return {
    id,
    title: null,
    createdAt: now,
    updatedAt: now,
    playerIds,
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId,
  };
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
});

describe('exportSheet', () => {
  test('builds sheet envelope with referenced players only', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('c', 'Carla'));
    await repositories.player().save(p('d', 'Dirk'));
    await repositories.player().save(p('z', 'Zelda'));
    await repositories.gameSheet().save(s('sheet-1', ['a', 'b', 'c', 'd']));

    const file = await exportSheet('sheet-1');

    expect(file.envelope.app).toBe(APP_TAG);
    expect(file.envelope.formatVersion).toBe(FORMAT_VERSION);
    expect(file.envelope.kind).toBe('sheet');
    expect(file.envelope.payload.sheets.map((sh) => sh.id)).toEqual(['sheet-1']);
    expect(file.envelope.payload.groups).toEqual([]);
    expect(file.envelope.payload.settings).toBeNull();
    const ids = file.envelope.payload.players.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  test('throws when sheet not found', async () => {
    await expect(exportSheet('does-not-exist')).rejects.toThrow();
  });
});

describe('exportGroup', () => {
  test('builds group envelope with all member sheets and union of players', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('c', 'Carla'));
    await repositories.player().save(p('d', 'Dirk'));
    await repositories.player().save(p('e', 'Eva'));
    await repositories.sheetGroup().save({
      id: 'g-1',
      name: 'Stammtisch',
      type: GroupType.season,
      createdAt: now,
      updatedAt: now,
      dirty: false,
    });
    await repositories.gameSheet().save(s('sh-1', ['a', 'b', 'c', 'd'], 'g-1'));
    await repositories.gameSheet().save(s('sh-2', ['a', 'b', 'c', 'e'], 'g-1'));
    await repositories.gameSheet().save(s('sh-3', ['a', 'b', 'c', 'd'], null));

    const file = await exportGroup('g-1');

    expect(file.envelope.kind).toBe('group');
    expect(file.envelope.payload.groups.map((g) => g.id)).toEqual(['g-1']);
    expect(file.envelope.payload.sheets.map((s) => s.id).sort()).toEqual(['sh-1', 'sh-2']);
    expect(file.envelope.payload.players.map((p) => p.id).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(file.envelope.payload.settings).toBeNull();
  });
});

describe('exportBackup', () => {
  test('builds backup envelope with everything', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('z', 'Zelda'));
    await repositories.sheetGroup().save({
      id: 'g-1',
      name: 'Stammtisch',
      type: GroupType.season,
      createdAt: now,
      updatedAt: now,
      dirty: false,
    });
    await repositories.gameSheet().save(s('sh-1', ['a', 'b', 'a', 'b'], 'g-1'));
    await repositories.settings().save({
      defaultStackingMode: BockStackingMode.doppelbock,
      language: 'de',
    });

    const file = await exportBackup();

    expect(file.envelope.kind).toBe('backup');
    expect(file.envelope.payload.players.map((p) => p.id).sort()).toEqual(['a', 'b', 'z']);
    expect(file.envelope.payload.groups.map((g) => g.id)).toEqual(['g-1']);
    expect(file.envelope.payload.sheets.map((s) => s.id)).toEqual(['sh-1']);
    expect(file.envelope.payload.settings).toEqual({
      defaultStackingMode: BockStackingMode.doppelbock,
      language: 'de',
    });
  });
});
