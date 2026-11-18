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
  playerIds: readonly string[],
  updatedAt = epoch,
  groupId: string | null = null,
): GameSheet {
  return {
    id,
    title: null,
    createdAt: epoch,
    playedAt: epoch,
    updatedAt,
    playerIds,
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId,
    substitutions: [],
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
  players: readonly Player[],
  sheets: readonly GameSheet[],
  groups: readonly SheetGroup[],
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

describe('buildImportPlan — group name match', () => {
  test('different id, same name (case/trim-insensitive) → mergeInto local group', () => {
    const local: LocalState = { ...emptyLocal, groups: [g('local-g', 'Saison 2026')] };
    const plan = buildImportPlan(
      envelope('group', [], [], [g('imp-g', '  saison 2026 ')]),
      local,
    );
    const d = plan.groups[0]!;
    expect(d.suggested).toEqual({ kind: 'mergeInto', localId: 'local-g' });
    expect(d.localMatchByName?.id).toBe('local-g');
  });
  test('same id wins over name match', () => {
    const local: LocalState = {
      ...emptyLocal,
      groups: [g('grp-1', 'Alt', epoch), g('other', 'Neu')],
    };
    const plan = buildImportPlan(envelope('group', [], [], [g('grp-1', 'Neu', newer)]), local);
    expect(plan.groups[0]!.suggested.kind).toBe('replaceLocal');
    expect(plan.groups[0]!.localMatchByName).toBeNull();
  });
  test('different name → addAsNew', () => {
    const local: LocalState = { ...emptyLocal, groups: [g('local-g', 'A')] };
    const plan = buildImportPlan(envelope('group', [], [], [g('imp-g', 'B')]), local);
    expect(plan.groups[0]!.suggested.kind).toBe('addAsNew');
  });
});

describe('buildImportPlan — possible duplicate sheets', () => {
  const four = ['a', 'b', 'c', 'd'];
  test('new id, same group/day/players → possibleDuplicateOf set, action stays addAsNew', () => {
    const local: LocalState = {
      ...emptyLocal,
      players: ['a', 'b', 'c', 'd'].map((x) => p(x, x)),
      sheets: [s('local-sh', four, epoch, 'grp')],
    };
    const plan = buildImportPlan(
      envelope('sheet', local.players, [s('imp-sh', [...four].reverse(), epoch, 'grp')], []),
      local,
    );
    expect(plan.sheets[0]!.possibleDuplicateOf?.id).toBe('local-sh');
    expect(plan.sheets[0]!.suggested.kind).toBe('addAsNew');
  });
  test('merged group and merged players are compared via local ids', () => {
    const local: LocalState = {
      ...emptyLocal,
      players: [p('la', 'Anna'), p('lb', 'Ben'), p('lc', 'Cem'), p('ld', 'Dora')],
      groups: [g('local-g', 'Saison')],
      sheets: [s('local-sh', ['la', 'lb', 'lc', 'ld'], epoch, 'local-g')],
    };
    const plan = buildImportPlan(
      envelope(
        'group',
        [p('ia', 'Anna'), p('ib', 'Ben'), p('ic', 'Cem'), p('id', 'Dora')],
        [s('imp-sh', ['ia', 'ib', 'ic', 'id'], epoch, 'imp-g')],
        [g('imp-g', 'Saison')],
      ),
      local,
    );
    expect(plan.sheets[0]!.possibleDuplicateOf?.id).toBe('local-sh');
  });
  test('different day, different players or different group → no warning', () => {
    const base = s('local-sh', four, epoch, 'grp');
    const local: LocalState = {
      ...emptyLocal,
      players: ['a', 'b', 'c', 'd', 'e'].map((x) => p(x, x)),
      sheets: [base],
    };
    const otherDay = { ...s('i1', four, epoch, 'grp'), playedAt: new Date('2026-06-15T12:00:00') };
    const otherPlayers = s('i2', ['a', 'b', 'c', 'e'], epoch, 'grp');
    const otherGroup = s('i3', four, epoch, 'grp2');
    const plan = buildImportPlan(
      envelope('sheet', local.players, [otherDay, otherPlayers, otherGroup], []),
      local,
    );
    expect(plan.sheets.map((d) => d.possibleDuplicateOf)).toEqual([null, null, null]);
  });
  test('same id (already local) → no duplicate warning', () => {
    const local: LocalState = {
      ...emptyLocal,
      sheets: [s('sh-1', four, epoch, 'grp')],
    };
    const plan = buildImportPlan(
      envelope('sheet', [], [s('sh-1', four, newer, 'grp')], []),
      local,
    );
    expect(plan.sheets[0]!.possibleDuplicateOf).toBeNull();
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
