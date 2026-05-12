import { exportBackup } from '@/application/export/exportService';
import { applyImportPlan } from '@/application/import/importApply';
import { buildImportPlan, type LocalState } from '@/application/import/importDiff';
import { parseExportFile } from '@/application/import/importParser';
import {
  _overrideRepositoriesForTest,
  repositories,
} from '@/application/stores/repositories';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createLocalSettingsRepository } from '@/data/repositories/settingsRepository';
import { createLocalSheetGroupRepository } from '@/data/repositories/sheetGroupRepository';
import type { GameSheet } from '@/domain/models/gameSheet';
import { GroupType } from '@/domain/models/groupType';
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

test('full backup round-trip into empty storage reproduces source byte-for-byte', async () => {
  // === Source storage ===
  const sourceStorage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage: sourceStorage,
    player: createLocalPlayerRepository(sourceStorage),
    gameSheet: createLocalGameSheetRepository(sourceStorage),
    sheetGroup: createLocalSheetGroupRepository(sourceStorage),
    settings: createLocalSettingsRepository(sourceStorage),
  });
  await repositories.player().save(p('a', 'Anna'));
  await repositories.player().save(p('b', 'Ben'));
  await repositories.player().save(p('c', 'Carla'));
  await repositories.player().save(p('d', 'Dirk'));
  await repositories.sheetGroup().save(g('grp-1', 'Stammtisch'));
  await repositories.gameSheet().save(s('sh-1', ['a', 'b', 'c', 'd'], 'grp-1'));
  await repositories.settings().save({
    defaultStackingMode: BockStackingMode.doppelbock,
    language: 'de',
  });

  const file = await exportBackup();
  const serialised = JSON.stringify(file.envelope);

  // === Target storage (empty) ===
  const targetStorage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage: targetStorage,
    player: createLocalPlayerRepository(targetStorage),
    gameSheet: createLocalGameSheetRepository(targetStorage),
    sheetGroup: createLocalSheetGroupRepository(targetStorage),
    settings: createLocalSettingsRepository(targetStorage),
  });

  const parsed = parseExportFile(serialised);
  const local: LocalState = {
    players: await repositories.player().loadAll(),
    groups: await repositories.sheetGroup().loadAll(),
    sheets: await repositories.gameSheet().loadAll(),
    settings: await repositories.settings().load(),
  };
  const plan = buildImportPlan(parsed, local);
  await applyImportPlan(plan, {
    settings: parsed.envelope.payload.settings ?? undefined,
  });

  // === Compare ===
  expect((await repositories.player().loadAll()).map((p) => p.id).sort()).toEqual([
    'a',
    'b',
    'c',
    'd',
  ]);
  const sheets = await repositories.gameSheet().loadAll();
  expect(sheets.map((s) => s.id)).toEqual(['sh-1']);
  expect(sheets[0]!.playerIds).toEqual(['a', 'b', 'c', 'd']);
  expect(sheets[0]!.groupId).toBe('grp-1');
  expect(await repositories.settings().load()).toEqual({
    defaultStackingMode: BockStackingMode.doppelbock,
    language: 'de',
  });
});

test('round-trip into storage with overlapping player id leaves the local pool entry unchanged', async () => {
  const sourceStorage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage: sourceStorage,
    player: createLocalPlayerRepository(sourceStorage),
    gameSheet: createLocalGameSheetRepository(sourceStorage),
    sheetGroup: createLocalSheetGroupRepository(sourceStorage),
    settings: createLocalSettingsRepository(sourceStorage),
  });
  await repositories.player().save(p('a', 'Anna-Source'));
  await repositories.player().save(p('b', 'Ben'));
  await repositories.player().save(p('c', 'Carla'));
  await repositories.player().save(p('d', 'Dirk'));
  await repositories.gameSheet().save(s('sh-1', ['a', 'b', 'c', 'd']));
  const file = await exportBackup();
  const serialised = JSON.stringify(file.envelope);

  const targetStorage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage: targetStorage,
    player: createLocalPlayerRepository(targetStorage),
    gameSheet: createLocalGameSheetRepository(targetStorage),
    sheetGroup: createLocalSheetGroupRepository(targetStorage),
    settings: createLocalSettingsRepository(targetStorage),
  });
  await repositories.player().save(p('a', 'Anna-Target'));

  const parsed = parseExportFile(serialised);
  const local: LocalState = {
    players: await repositories.player().loadAll(),
    groups: [],
    sheets: [],
    settings: await repositories.settings().load(),
  };
  const plan = buildImportPlan(parsed, local);
  await applyImportPlan(plan, {
    settings: parsed.envelope.payload.settings ?? undefined,
  });

  const annaAfter = (await repositories.player().loadAll()).find((p) => p.id === 'a');
  expect(annaAfter?.playerName).toBe('Anna-Target');
});
