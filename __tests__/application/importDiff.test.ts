import { buildImportPlan, type LocalState } from '@/application/import/importDiff';
import type { ParsedExportFile } from '@/application/import/importParser';
import { appSettingsFallback } from '@/domain/models/appSettings';
import type { GameSheet } from '@/domain/models/gameSheet';
import { GroupType } from '@/domain/models/groupType';
import type { Player } from '@/domain/models/player';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import { APP_TAG, FORMAT_VERSION } from '@/application/export/exportTypes';

const epoch = new Date('2026-05-01T00:00:00.000Z');
const newer = new Date('2026-05-12T00:00:00.000Z');

function p(id: string, name: string): Player {
  return { id, playerName: name, firstName: null, lastName: null };
}

function s(
  id: string,
  playerIds: ReadonlyArray<string>,
  updatedAt = epoch,
  groupId: string | null = null,
): GameSheet {
  return {
    id,
    title: null,
    createdAt: epoch,
    updatedAt,
    playerIds,
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId,
  };
}

function g(id: string, name: string, updatedAt = epoch): SheetGroup {
  return {
    id,
    name,
    type: GroupType.season,
    createdAt: epoch,
    updatedAt,
    dirty: false,
  };
}

function envelope(
  kind: 'sheet' | 'group' | 'backup',
  players: ReadonlyArray<Player>,
  sheets: ReadonlyArray<GameSheet>,
  groups: ReadonlyArray<SheetGroup>,
  settings = null as null | typeof appSettingsFallback,
): ParsedExportFile {
  return {
    envelope: {
      app: APP_TAG,
      formatVersion: FORMAT_VERSION,
      kind,
      exportedAt: '2026-05-12T00:00:00.000Z',
      exportedFromAppVersion: '0.1.0',
      payload: { players, sheets, groups, settings },
    },
  };
}

const emptyLocal: LocalState = {
  players: [],
  groups: [],
  sheets: [],
  settings: appSettingsFallback,
};

describe('buildImportPlan — players', () => {
  test('same id → useLocal', () => {
    const local: LocalState = { ...emptyLocal, players: [p('a', 'Anna')] };
    const plan = buildImportPlan(
      envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'])], []),
      local,
    );
    expect(plan.players[0]!.suggested.kind).toBe('useLocal');
  });
  test('different id, same name → mergeInto suggested', () => {
    const local: LocalState = { ...emptyLocal, players: [p('local-a', 'Anna')] };
    const plan = buildImportPlan(
      envelope(
        'sheet',
        [p('imp-a', 'Anna')],
        [s('sh-1', ['imp-a', 'imp-a', 'imp-a', 'imp-a'])],
        [],
      ),
      local,
    );
    const d = plan.players[0]!;
    expect(d.suggested.kind).toBe('mergeInto');
    expect(d.suggested.kind === 'mergeInto' && d.suggested.localId).toBe('local-a');
  });
  test('different id, no name match → addAsNew suggested', () => {
    const local: LocalState = { ...emptyLocal, players: [p('local-a', 'Anna')] };
    const plan = buildImportPlan(
      envelope(
        'sheet',
        [p('imp-z', 'Zoe')],
        [s('sh-1', ['imp-z', 'imp-z', 'imp-z', 'imp-z'])],
        [],
      ),
      local,
    );
    expect(plan.players[0]!.suggested.kind).toBe('addAsNew');
  });
});

describe('buildImportPlan — sheets', () => {
  test('new id → addAsNew suggested', () => {
    const plan = buildImportPlan(
      envelope('sheet', [p('a', 'Anna')], [s('sh-new', ['a', 'a', 'a', 'a'])], []),
      emptyLocal,
    );
    expect(plan.sheets[0]!.suggested.kind).toBe('addAsNew');
  });
  test('existing id, same updatedAt → useLocal', () => {
    const local: LocalState = {
      ...emptyLocal,
      sheets: [s('sh-1', ['a', 'a', 'a', 'a'], epoch)],
    };
    const plan = buildImportPlan(
      envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'], epoch)], []),
      local,
    );
    expect(plan.sheets[0]!.suggested.kind).toBe('useLocal');
  });
  test('existing id, imported newer → replaceLocal suggested', () => {
    const local: LocalState = {
      ...emptyLocal,
      sheets: [s('sh-1', ['a', 'a', 'a', 'a'], epoch)],
    };
    const plan = buildImportPlan(
      envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'], newer)], []),
      local,
    );
    expect(plan.sheets[0]!.suggested.kind).toBe('replaceLocal');
  });
  test('existing id, imported older → keepLocal suggested', () => {
    const local: LocalState = {
      ...emptyLocal,
      sheets: [s('sh-1', ['a', 'a', 'a', 'a'], newer)],
    };
    const plan = buildImportPlan(
      envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'], epoch)], []),
      local,
    );
    expect(plan.sheets[0]!.suggested.kind).toBe('keepLocal');
  });
});

describe('buildImportPlan — groups', () => {
  test('new id → addAsNew', () => {
    const plan = buildImportPlan(
      envelope('group', [], [], [g('grp-new', 'X')]),
      emptyLocal,
    );
    expect(plan.groups[0]!.suggested.kind).toBe('addAsNew');
  });
  test('existing id, imported newer → replaceLocal', () => {
    const local: LocalState = { ...emptyLocal, groups: [g('grp-1', 'Old', epoch)] };
    const plan = buildImportPlan(
      envelope('group', [], [], [g('grp-1', 'New', newer)]),
      local,
    );
    expect(plan.groups[0]!.suggested.kind).toBe('replaceLocal');
  });
});

describe('buildImportPlan — settings (backup only)', () => {
  test('null payload settings → no settings decision', () => {
    const plan = buildImportPlan(
      envelope('sheet', [], [s('sh-1', ['a', 'a', 'a', 'a'])], []),
      emptyLocal,
    );
    expect(plan.settings).toBeNull();
  });
  test('backup with differing settings → replace suggested', () => {
    const plan = buildImportPlan(
      envelope('backup', [], [], [], { ...appSettingsFallback, language: 'de' }),
      { ...emptyLocal, settings: { ...appSettingsFallback, language: 'en' } },
    );
    expect(plan.settings?.suggested).toBe('replace');
  });
  test('backup with same settings → keep suggested', () => {
    const plan = buildImportPlan(
      envelope('backup', [], [], [], appSettingsFallback),
      { ...emptyLocal, settings: appSettingsFallback },
    );
    expect(plan.settings?.suggested).toBe('keep');
  });
});

describe('buildImportPlan — skip cascade', () => {
  test('player skip cascades sheets referencing that player to skip', () => {
    const parsed = envelope(
      'sheet',
      [p('imp-a', 'NewName')],
      [s('sh-1', ['imp-a', 'imp-a', 'imp-a', 'imp-a'])],
      [],
    );
    const planA = buildImportPlan(parsed, emptyLocal);
    expect(planA.sheets[0]!.suggested.kind).toBe('addAsNew');
    const planB = buildImportPlan(parsed, emptyLocal, {
      playerOverrides: { 'imp-a': { kind: 'skip' } },
    });
    expect(planB.sheets[0]!.suggested.kind).toBe('skip');
  });
});
