import { applyImportPlan } from '@/application/import/importApply';
import type { ImportPlan } from '@/application/import/importDiff';
import {
  _overrideRepositoriesForTest,
  repositories,
} from '@/application/stores/repositories';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createLocalSettingsRepository } from '@/data/repositories/settingsRepository';
import { createLocalSheetGroupRepository } from '@/data/repositories/sheetGroupRepository';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { GroupType } from '@/domain/models/groupType';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { createInMemoryStorage } from '../data/_inMemoryStorage';

const epoch = new Date('2026-05-01T00:00:00.000Z');

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
    createdAt: epoch,
    updatedAt: epoch,
    playerIds,
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId,
  };
}
function g(id: string, name: string): SheetGroup {
  return {
    id,
    name,
    type: GroupType.season,
    createdAt: epoch,
    updatedAt: epoch,
    dirty: false,
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

describe('applyImportPlan — players', () => {
  test('addAsNew writes pool entry with imported id', async () => {
    const plan: ImportPlan = {
      players: [
        {
          imported: p('imp-a', 'Anna'),
          suggested: { kind: 'addAsNew' },
          localMatchById: null,
          localMatchByName: null,
        },
      ],
      groups: [],
      sheets: [],
      settings: null,
    };
    const result = await applyImportPlan(plan);
    expect(result.playersAdded).toBe(1);
    expect(await repositories.player().loadAll()).toEqual([p('imp-a', 'Anna')]);
  });

  test('mergeInto remaps a sheet that referenced imported id', async () => {
    await repositories.player().save(p('local-a', 'Anna'));
    await repositories.player().save(p('local-b', 'Ben'));
    await repositories.player().save(p('local-c', 'Carla'));
    await repositories.player().save(p('local-d', 'Dirk'));
    const plan: ImportPlan = {
      players: [
        {
          imported: p('imp-a', 'Anna'),
          suggested: { kind: 'mergeInto', localId: 'local-a' },
          localMatchById: null,
          localMatchByName: 'local-a',
        },
        {
          imported: p('local-b', 'Ben'),
          suggested: { kind: 'useLocal', localId: 'local-b' },
          localMatchById: 'local-b',
          localMatchByName: 'local-b',
        },
        {
          imported: p('local-c', 'Carla'),
          suggested: { kind: 'useLocal', localId: 'local-c' },
          localMatchById: 'local-c',
          localMatchByName: 'local-c',
        },
        {
          imported: p('local-d', 'Dirk'),
          suggested: { kind: 'useLocal', localId: 'local-d' },
          localMatchById: 'local-d',
          localMatchByName: 'local-d',
        },
      ],
      groups: [],
      sheets: [
        {
          imported: s('imp-sh', ['imp-a', 'local-b', 'local-c', 'local-d']),
          localExisting: null,
          suggested: { kind: 'addAsNew' },
        },
      ],
      settings: null,
    };
    const result = await applyImportPlan(plan);
    expect(result.playersMerged).toBe(1);
    expect(result.sheetsAdded).toBe(1);
    const stored = await repositories.gameSheet().load('imp-sh');
    expect(stored?.playerIds).toEqual(['local-a', 'local-b', 'local-c', 'local-d']);
  });
});

describe('applyImportPlan — sheets', () => {
  test('replaceLocal overwrites', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('c', 'Carla'));
    await repositories.player().save(p('d', 'Dirk'));
    await repositories.gameSheet().save({ ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'Old' });
    const plan: ImportPlan = {
      players: [],
      groups: [],
      sheets: [
        {
          imported: { ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'New' },
          localExisting: s('sh-1', ['a', 'b', 'c', 'd']),
          suggested: { kind: 'replaceLocal' },
        },
      ],
      settings: null,
    };
    const result = await applyImportPlan(plan);
    expect(result.sheetsReplaced).toBe(1);
    const stored = await repositories.gameSheet().load('sh-1');
    expect(stored?.title).toBe('New');
  });

  test('keepLocal is a no-op', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('c', 'Carla'));
    await repositories.player().save(p('d', 'Dirk'));
    await repositories.gameSheet().save({ ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'Local' });
    const plan: ImportPlan = {
      players: [],
      groups: [],
      sheets: [
        {
          imported: { ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'Imported' },
          localExisting: s('sh-1', ['a', 'b', 'c', 'd']),
          suggested: { kind: 'keepLocal' },
        },
      ],
      settings: null,
    };
    await applyImportPlan(plan);
    const stored = await repositories.gameSheet().load('sh-1');
    expect(stored?.title).toBe('Local');
  });

  test('addCopy assigns a fresh id', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('c', 'Carla'));
    await repositories.player().save(p('d', 'Dirk'));
    await repositories.gameSheet().save(s('sh-1', ['a', 'b', 'c', 'd']));
    const plan: ImportPlan = {
      players: [],
      groups: [],
      sheets: [
        {
          imported: { ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'CopyMe' },
          localExisting: s('sh-1', ['a', 'b', 'c', 'd']),
          suggested: { kind: 'addCopy' },
        },
      ],
      settings: null,
    };
    const result = await applyImportPlan(plan);
    expect(result.sheetsCopied).toBe(1);
    const all = await repositories.gameSheet().loadAll();
    expect(all.length).toBe(2);
    const copy = all.find((s) => s.title === 'CopyMe');
    expect(copy?.id).not.toBe('sh-1');
  });

  test('skip is a no-op', async () => {
    const plan: ImportPlan = {
      players: [],
      groups: [],
      sheets: [
        {
          imported: s('sh-1', ['a', 'b', 'c', 'd']),
          localExisting: null,
          suggested: { kind: 'skip' },
        },
      ],
      settings: null,
    };
    const result = await applyImportPlan(plan);
    expect(result.sheetsSkipped).toBe(1);
    expect(await repositories.gameSheet().loadAll()).toEqual([]);
  });
});

describe('applyImportPlan — groups remap', () => {
  test('group addCopy gives sheets the new groupId', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('c', 'Carla'));
    await repositories.player().save(p('d', 'Dirk'));
    await repositories.sheetGroup().save(g('grp-1', 'LocalGroup'));
    const plan: ImportPlan = {
      players: [],
      groups: [
        {
          imported: g('grp-1', 'ImportedGroup'),
          localExisting: g('grp-1', 'LocalGroup'),
          suggested: { kind: 'addCopy' },
        },
      ],
      sheets: [
        {
          imported: s('sh-1', ['a', 'b', 'c', 'd'], 'grp-1'),
          localExisting: null,
          suggested: { kind: 'addAsNew' },
        },
      ],
      settings: null,
    };
    await applyImportPlan(plan);
    const stored = await repositories.gameSheet().load('sh-1');
    expect(stored?.groupId).not.toBe('grp-1');
    expect(stored?.groupId).toBeTruthy();
    const copyGroup = (await repositories.sheetGroup().loadAll()).find(
      (g) => g.name === 'ImportedGroup',
    );
    expect(stored?.groupId).toBe(copyGroup?.id);
  });
});

describe('applyImportPlan — settings', () => {
  test('replace overwrites', async () => {
    const plan: ImportPlan = {
      players: [],
      groups: [],
      sheets: [],
      settings: { suggested: 'replace' },
    };
    const imported = {
      defaultStackingMode: BockStackingMode.doppelbock,
      language: 'de' as const,
    };
    const result = await applyImportPlan(plan, { settings: imported });
    expect(result.settingsReplaced).toBe(true);
    expect(await repositories.settings().load()).toEqual(imported);
  });

  test('keep leaves local untouched', async () => {
    await repositories.settings().save(appSettingsFallback);
    const plan: ImportPlan = {
      players: [],
      groups: [],
      sheets: [],
      settings: { suggested: 'keep' },
    };
    await applyImportPlan(plan, { settings: { ...appSettingsFallback, language: 'de' } });
    expect(await repositories.settings().load()).toEqual(appSettingsFallback);
  });
});
