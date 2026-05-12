# Export / Import (Spec 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add export of single sheet / group with sheets / full backup as JSON files via the OS share sheet, plus import via Document Picker with an interactive conflict-review screen. Encryption is out of scope (Spec 2b).

**Architecture:** Eight commits, each leaving `pnpm typecheck` and `pnpm test` green. Order: (1) envelope + dependencies; (2) export-service pure data assembly; (3) file-share wrapper + filename normalisation; (4) export UI entry points; (5) import parser; (6) import diff; (7) import apply; (8) review screen + import entry + integration round-trip test.

**Tech Stack:** React Native + Expo, expo-sharing, expo-document-picker, expo-file-system (already present), react-native-paper, Zustand, i18next, Jest, TypeScript (strict).

**Reference spec:** [docs/superpowers/specs/2026-05-12-export-import-design.md](../specs/2026-05-12-export-import-design.md)

---

## File Map

- Create: `src/application/export/exportTypes.ts` — `ExportEnvelope`, `ExportPayload`, `ExportFile` types; `APP_TAG`, `FORMAT_VERSION` constants.
- Create: `src/application/export/exportService.ts` — pure data-assembly: `exportSheet`, `exportGroup`, `exportBackup`.
- Create: `src/application/export/filename.ts` — `suggestFilename(scope, dateIso)` with normalisation.
- Create: `src/data/export/fileShare.ts` — `shareExport(file)` writes to cache + invokes `Sharing.shareAsync`.
- Modify: `src/presentation/screens/SheetScreen.tsx` — add `Bogen exportieren...` menu item.
- Modify: `src/presentation/screens/GroupManagementScreen.tsx` — add `Gruppe exportieren...` menu item.
- Modify: `src/presentation/screens/SettingsScreen.tsx` — add `Backup exportieren` and `Import...` buttons.
- Create: `src/application/import/importParser.ts` — `parseExportFile`, `ParseError`.
- Create: `src/application/import/importDiff.ts` — `buildImportPlan`, decision types.
- Create: `src/application/import/importApply.ts` — `applyImportPlan`, `ImportResult`.
- Create: `src/presentation/screens/ImportReviewScreen.tsx` — conflict review UI.
- Modify: `app/_layout.tsx` — register the new `import/review` route.
- Create: `app/import/review.tsx` — Expo Router screen wrapper.
- Modify: `package.json` — add `expo-sharing`, `expo-document-picker` (via `pnpm expo install`).
- Modify: `src/presentation/i18n/locales/de.ts` — new i18n keys under `export` and `import` blocks.
- Modify: `src/presentation/i18n/locales/en.ts` — same.
- Create: `__tests__/application/exportService.test.ts`
- Create: `__tests__/application/filename.test.ts`
- Create: `__tests__/application/importParser.test.ts`
- Create: `__tests__/application/importDiff.test.ts`
- Create: `__tests__/application/importApply.test.ts`
- Create: `__tests__/integration/exportImportRoundtrip.test.ts`

---

## Task 1: Envelope types + dependencies

**Files:**
- Modify: `package.json` (via `pnpm expo install`)
- Create: `src/application/export/exportTypes.ts`
- Create: `src/application/export/filename.ts`
- Create: `__tests__/application/filename.test.ts`

- [ ] **Step 1: Install Expo modules**

```bash
pnpm expo install expo-sharing expo-document-picker
```

Verify they end up in `package.json` `dependencies` with the right SDK-54-compatible versions. Do not edit versions by hand.

- [ ] **Step 2: Write failing filename test**

Create `__tests__/application/filename.test.ts`:

```ts
import { suggestFilename } from '@/application/export/filename';

describe('suggestFilename', () => {
  test('basic name + date', () => {
    expect(suggestFilename('Stammtisch', '2026-05-12')).toBe(
      'bockzettel-stammtisch-2026-05-12.json',
    );
  });
  test('umlauts are folded to ascii', () => {
    expect(suggestFilename('Müllers Geburtstag', '2026-05-12')).toBe(
      'bockzettel-muellers-geburtstag-2026-05-12.json',
    );
  });
  test('special chars and runs of dashes are collapsed', () => {
    expect(suggestFilename('  Foo // Bar!?  ', '2026-05-12')).toBe(
      'bockzettel-foo-bar-2026-05-12.json',
    );
  });
  test('empty scope falls back to fallback', () => {
    expect(suggestFilename('', '2026-05-12')).toBe(
      'bockzettel-bogen-2026-05-12.json',
    );
  });
  test('all-special scope falls back', () => {
    expect(suggestFilename('???', '2026-05-12')).toBe(
      'bockzettel-bogen-2026-05-12.json',
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test -- filename`

Expected: FAIL with module-not-found for `@/application/export/filename`.

- [ ] **Step 4: Implement filename**

Create `src/application/export/filename.ts`:

```ts
const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

/**
 * Erzeugt einen lesbaren Dateinamen `bockzettel-<scope>-<date>.json`.
 * Normalisiert `scope` zu ASCII-Lower-Case + Bindestrichen; bei leerem
 * Ergebnis Fallback `bogen`.
 */
export function suggestFilename(scope: string, dateIso: string): string {
  const slug = slugify(scope);
  const safeScope = slug === '' ? 'bogen' : slug;
  return `bockzettel-${safeScope}-${dateIso}.json`;
}

function slugify(s: string): string {
  const folded = [...s.trim()]
    .map((c) => UMLAUT_MAP[c] ?? c)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 5: Create envelope types**

Create `src/application/export/exportTypes.ts`:

```ts
import type { AppSettings } from '@/domain/models/appSettings';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { SheetGroup } from '@/domain/models/sheetGroup';

export const APP_TAG = 'doppelkopf_schreiber';
export const FORMAT_VERSION = 1;

export type ExportKind = 'sheet' | 'group' | 'backup';

export interface ExportPayload {
  readonly players: ReadonlyArray<Player>;
  readonly sheets: ReadonlyArray<GameSheet>;
  readonly groups: ReadonlyArray<SheetGroup>;
  readonly settings: AppSettings | null;
}

export interface ExportEnvelope {
  readonly app: typeof APP_TAG;
  readonly formatVersion: typeof FORMAT_VERSION;
  readonly kind: ExportKind;
  readonly exportedAt: string;          // ISO 8601
  readonly exportedFromAppVersion: string;
  readonly payload: ExportPayload;
}

export interface ExportFile {
  readonly envelope: ExportEnvelope;
  readonly suggestedFilename: string;
}
```

- [ ] **Step 6: Run the filename tests + typecheck**

Run: `pnpm test -- filename && pnpm typecheck`

Expected: 5 tests pass, typecheck green.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml \
        src/application/export/exportTypes.ts \
        src/application/export/filename.ts \
        __tests__/application/filename.test.ts
git commit -m "feat(export): add envelope types and filename helper"
```

---

## Task 2: exportService — pure data assembly

**Files:**
- Create: `src/application/export/exportService.ts`
- Create: `__tests__/application/exportService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/application/exportService.test.ts`:

```ts
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

function s(id: string, playerIds: ReadonlyArray<string>, groupId: string | null = null): GameSheet {
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
    await repositories.player().save(p('z', 'Zelda'));   // unreferenced
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
    await repositories.gameSheet().save(s('sh-3', ['a', 'b', 'c', 'd'], null));  // not in group

    const file = await exportGroup('g-1');

    expect(file.envelope.kind).toBe('group');
    expect(file.envelope.payload.groups.map((g) => g.id)).toEqual(['g-1']);
    expect(file.envelope.payload.sheets.map((s) => s.id).sort()).toEqual(['sh-1', 'sh-2']);
    expect(file.envelope.payload.players.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(file.envelope.payload.settings).toBeNull();
  });
});

describe('exportBackup', () => {
  test('builds backup envelope with everything', async () => {
    await repositories.player().save(p('a', 'Anna'));
    await repositories.player().save(p('b', 'Ben'));
    await repositories.player().save(p('z', 'Zelda'));   // unreferenced but still exported
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
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- exportService`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement exportService**

Create `src/application/export/exportService.ts`:

```ts
import Constants from 'expo-constants';

import { repositories } from '@/application/stores/repositories';
import {
  APP_TAG,
  FORMAT_VERSION,
  type ExportEnvelope,
  type ExportFile,
  type ExportPayload,
} from '@/application/export/exportTypes';
import { suggestFilename } from '@/application/export/filename';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function appVersion(): string {
  const v = Constants.expoConfig?.version;
  return typeof v === 'string' ? v : 'unknown';
}

function envelope(
  kind: 'sheet' | 'group' | 'backup',
  payload: ExportPayload,
  exportedAt: Date,
): ExportEnvelope {
  return {
    app: APP_TAG,
    formatVersion: FORMAT_VERSION,
    kind,
    exportedAt: exportedAt.toISOString(),
    exportedFromAppVersion: appVersion(),
    payload,
  };
}

export async function exportSheet(sheetId: string): Promise<ExportFile> {
  const sheet = await repositories.gameSheet().load(sheetId);
  if (sheet === null) {
    throw new Error(`Spielbogen nicht gefunden: ${sheetId}`);
  }
  const referencedIds = new Set(sheet.playerIds);
  const pool = await repositories.player().loadAll();
  const players = pool.filter((p) => referencedIds.has(p.id));

  const now = new Date();
  const file: ExportFile = {
    envelope: envelope(
      'sheet',
      { players, sheets: [sheet], groups: [], settings: null },
      now,
    ),
    suggestedFilename: suggestFilename(sheet.title ?? '', isoDate(now)),
  };
  return file;
}

export async function exportGroup(groupId: string): Promise<ExportFile> {
  const group = await repositories.sheetGroup().load(groupId);
  if (group === null) {
    throw new Error(`Gruppe nicht gefunden: ${groupId}`);
  }
  const allSheets = await repositories.gameSheet().loadAll();
  const sheets = allSheets.filter((s) => s.groupId === groupId);

  const referencedIds = new Set<string>();
  for (const s of sheets) {
    for (const id of s.playerIds) referencedIds.add(id);
  }
  const pool = await repositories.player().loadAll();
  const players = pool.filter((p) => referencedIds.has(p.id));

  const now = new Date();
  return {
    envelope: envelope(
      'group',
      { players, sheets, groups: [group], settings: null },
      now,
    ),
    suggestedFilename: suggestFilename(group.name, isoDate(now)),
  };
}

export async function exportBackup(): Promise<ExportFile> {
  const [players, groups, sheets, settings] = await Promise.all([
    repositories.player().loadAll(),
    repositories.sheetGroup().loadAll(),
    repositories.gameSheet().loadAll(),
    repositories.settings().load(),
  ]);

  const now = new Date();
  return {
    envelope: envelope(
      'backup',
      { players, sheets, groups, settings },
      now,
    ),
    suggestedFilename: suggestFilename('backup', isoDate(now)),
  };
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test -- exportService && pnpm typecheck`

Expected: 4 tests pass, typecheck green.

- [ ] **Step 5: Commit**

```bash
git add src/application/export/exportService.ts \
        __tests__/application/exportService.test.ts
git commit -m "feat(export): assemble envelope per scope"
```

---

## Task 3: fileShare — write to cache + invoke share sheet

**Files:**
- Create: `src/data/export/fileShare.ts`

No automated test for this module — `Sharing.shareAsync` and `FileSystem` writes are platform side effects. Verified manually after Task 4 wires it up.

- [ ] **Step 1: Implement**

Create `src/data/export/fileShare.ts`:

```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { ExportFile } from '@/application/export/exportTypes';

/**
 * Serialisiert den Envelope als pretty-printed JSON, legt die Datei im
 * Cache-Verzeichnis ab und ruft das System-Share-Sheet auf.
 * Cache-Aufraeumen uebernimmt das OS; wir loeschen nichts aktiv.
 */
export async function shareExport(file: ExportFile): Promise<void> {
  const cacheDir = `${FileSystem.cacheDirectory ?? ''}exports/`;
  const info = await FileSystem.getInfoAsync(cacheDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }

  const path = `${cacheDir}${file.suggestedFilename}`;
  const json = JSON.stringify(file.envelope, null, 2);
  await FileSystem.writeAsStringAsync(path, json);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing ist auf diesem Geraet nicht verfuegbar.');
  }
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Bockzettel teilen',
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/data/export/fileShare.ts
git commit -m "feat(export): write to cache and invoke OS share sheet"
```

---

## Task 4: Export UI entry points + i18n

**Files:**
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`
- Modify: `src/presentation/screens/SheetScreen.tsx`
- Modify: `src/presentation/screens/GroupManagementScreen.tsx`
- Modify: `src/presentation/screens/SettingsScreen.tsx`

- [ ] **Step 1: Add i18n keys (DE)**

Edit `src/presentation/i18n/locales/de.ts`. Add a new top-level block before the closing brace:

```ts
exportImport: {
  exportSheetMenu: 'Bogen exportieren...',
  exportGroupMenu: 'Gruppe exportieren...',
  exportBackupButton: 'Backup exportieren',
  importButton: 'Import...',
  exportInProgress: 'Export wird vorbereitet...',
  exportFailed: 'Export fehlgeschlagen',
  shareDialogTitle: 'Bockzettel teilen',
},
```

- [ ] **Step 2: Add i18n keys (EN) with matching shape**

Edit `src/presentation/i18n/locales/en.ts`. Add the same block:

```ts
exportImport: {
  exportSheetMenu: 'Export sheet...',
  exportGroupMenu: 'Export group...',
  exportBackupButton: 'Export backup',
  importButton: 'Import...',
  exportInProgress: 'Preparing export...',
  exportFailed: 'Export failed',
  shareDialogTitle: 'Share Bockzettel',
},
```

- [ ] **Step 3: Run locale-shape test**

Run: `pnpm test -- localesShape`

Expected: green (parity).

- [ ] **Step 4: Wire SheetScreen menu**

Edit `src/presentation/screens/SheetScreen.tsx`. Add the import:

```ts
import { exportSheet } from '@/application/export/exportService';
import { shareExport } from '@/data/export/fileShare';
```

Find the existing `<Menu>` block (around line 203 — the dots-vertical menu). Add a third `Menu.Item` after the existing `menuGroup` item:

```tsx
<Menu.Item
  title={t('exportImport.exportSheetMenu')}
  onPress={() => {
    setMenuOpen(false);
    void (async () => {
      try {
        const file = await exportSheet(sheet.id);
        await shareExport(file);
      } catch (e) {
        console.error(t('exportImport.exportFailed'), e);
      }
    })();
  }}
/>
```

- [ ] **Step 5: Wire GroupManagementScreen menu**

Edit `src/presentation/screens/GroupManagementScreen.tsx`. Add imports:

```ts
import { exportGroup } from '@/application/export/exportService';
import { shareExport } from '@/data/export/fileShare';
```

Find the per-group `<Menu>` (look for `menuRename`/`menuChangeType`/`menuDelete` items). Add a new `Menu.Item` for export, just before the delete entry:

```tsx
<Menu.Item
  title={t('exportImport.exportGroupMenu')}
  onPress={() => {
    setMenuForId(null);
    void (async () => {
      try {
        const file = await exportGroup(g.id);
        await shareExport(file);
      } catch (e) {
        console.error(t('exportImport.exportFailed'), e);
      }
    })();
  }}
/>
```

- [ ] **Step 6: Wire SettingsScreen export-backup button**

Edit `src/presentation/screens/SettingsScreen.tsx`. Add imports:

```ts
import { exportBackup } from '@/application/export/exportService';
import { shareExport } from '@/data/export/fileShare';
import { Button } from 'react-native-paper';
```

(`Button` may already be present — keep one import.) After the existing language `<SegmentedButtons>` block, append a new section in the ScrollView:

```tsx
<View style={{ gap: 12 }}>
  <Text variant="titleMedium">{t('exportImport.exportBackupButton')}</Text>
  <Button
    mode="contained-tonal"
    icon="export"
    onPress={() => {
      void (async () => {
        try {
          const file = await exportBackup();
          await shareExport(file);
        } catch (e) {
          console.error(t('exportImport.exportFailed'), e);
        }
      })();
    }}
  >
    {t('exportImport.exportBackupButton')}
  </Button>
</View>
```

The `Import...` button will be added in Task 8 once the review screen exists.

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm test && pnpm lint`

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/i18n/locales/de.ts \
        src/presentation/i18n/locales/en.ts \
        src/presentation/screens/SheetScreen.tsx \
        src/presentation/screens/GroupManagementScreen.tsx \
        src/presentation/screens/SettingsScreen.tsx
git commit -m "feat(export): UI entry points for sheet, group, and backup export"
```

---

## Task 5: importParser

**Files:**
- Create: `src/application/import/importParser.ts`
- Create: `__tests__/application/importParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/application/importParser.test.ts`:

```ts
import {
  parseExportFile,
  ParseError,
} from '@/application/import/importParser';
import { APP_TAG, FORMAT_VERSION } from '@/application/export/exportTypes';

function validSheetEnvelope() {
  return {
    app: APP_TAG,
    formatVersion: FORMAT_VERSION,
    kind: 'sheet',
    exportedAt: '2026-05-12T15:00:00.000Z',
    exportedFromAppVersion: '0.1.0',
    payload: {
      players: [
        { id: 'a', playerName: 'Anna' },
        { id: 'b', playerName: 'Ben' },
        { id: 'c', playerName: 'Carla' },
        { id: 'd', playerName: 'Dirk' },
      ],
      sheets: [
        {
          id: 'sh-1',
          title: null,
          createdAt: '2026-05-12T14:00:00.000Z',
          updatedAt: '2026-05-12T14:00:00.000Z',
          playerIds: ['a', 'b', 'c', 'd'],
          rounds: [],
          dirty: false,
          stackingModeOverride: null,
          groupId: null,
        },
      ],
      groups: [],
      settings: null,
    },
  };
}

describe('parseExportFile happy paths', () => {
  test('sheet envelope round-trips', () => {
    const raw = JSON.stringify(validSheetEnvelope());
    const parsed = parseExportFile(raw);
    expect(parsed.envelope.kind).toBe('sheet');
    expect(parsed.envelope.payload.sheets[0]!.playerIds).toEqual(['a', 'b', 'c', 'd']);
  });
  test('forward-compatible: unknown payload fields are ignored', () => {
    const e = validSheetEnvelope();
    (e.payload as Record<string, unknown>)['somethingNew'] = 42;
    (e as Record<string, unknown>)['futureMetadata'] = 'hello';
    const parsed = parseExportFile(JSON.stringify(e));
    expect(parsed.envelope.kind).toBe('sheet');
  });
});

describe('parseExportFile errors', () => {
  test('non-JSON throws ParseError with readable message', () => {
    expect(() => parseExportFile('not json {')).toThrow(ParseError);
  });
  test('wrong app field throws', () => {
    const e = validSheetEnvelope();
    (e as Record<string, unknown>)['app'] = 'some_other_app';
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/app/);
  });
  test('wrong formatVersion throws', () => {
    const e = validSheetEnvelope();
    (e as Record<string, unknown>)['formatVersion'] = 99;
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/formatVersion/);
  });
  test('unknown kind throws', () => {
    const e = validSheetEnvelope();
    (e as Record<string, unknown>)['kind'] = 'cake';
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/kind/);
  });
  test('sheet kind with two sheets violates invariant', () => {
    const e = validSheetEnvelope();
    e.payload.sheets.push({ ...e.payload.sheets[0]!, id: 'sh-2' });
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/sheet/);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- importParser`

Expected: module-not-found.

- [ ] **Step 3: Implement**

Create `src/application/import/importParser.ts`:

```ts
import { appSettingsFromJson, type AppSettings } from '@/domain/models/appSettings';
import { gameSheetFromJson, type GameSheet } from '@/domain/models/gameSheet';
import { playerFromJson, type Player } from '@/domain/models/player';
import { sheetGroupFromJson, type SheetGroup } from '@/domain/models/sheetGroup';
import {
  APP_TAG,
  FORMAT_VERSION,
  type ExportEnvelope,
  type ExportKind,
} from '@/application/export/exportTypes';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export interface ParsedExportFile {
  readonly envelope: ExportEnvelope;
}

export function parseExportFile(rawText: string): ParsedExportFile {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch (e) {
    throw new ParseError(`Datei ist kein gueltiges JSON: ${(e as Error).message}`);
  }
  if (!isObject(json)) {
    throw new ParseError('Datei ist kein JSON-Objekt.');
  }
  if (json['app'] !== APP_TAG) {
    throw new ParseError(`Unbekanntes app-Feld: ${String(json['app'])} (erwartet ${APP_TAG}).`);
  }
  if (json['formatVersion'] !== FORMAT_VERSION) {
    throw new ParseError(
      `Unbekannte formatVersion: ${String(json['formatVersion'])} (erwartet ${FORMAT_VERSION}).`,
    );
  }
  const kind = json['kind'];
  if (kind !== 'sheet' && kind !== 'group' && kind !== 'backup') {
    throw new ParseError(`Unbekanntes kind-Feld: ${String(kind)}.`);
  }
  const payload = json['payload'];
  if (!isObject(payload)) {
    throw new ParseError('Payload fehlt oder ist kein Objekt.');
  }

  const players = readArray(payload['players']).map(playerFromJson);
  const sheets = readArray(payload['sheets']).map(gameSheetFromJson);
  const groups = readArray(payload['groups']).map(sheetGroupFromJson);
  const settings = readSettings(payload['settings']);

  validatePerKind(kind, { sheets: sheets.length, groups: groups.length, hasSettings: settings !== null });

  const exportedAt = typeof json['exportedAt'] === 'string' ? json['exportedAt'] : new Date(0).toISOString();
  const exportedFromAppVersion = typeof json['exportedFromAppVersion'] === 'string'
    ? json['exportedFromAppVersion']
    : 'unknown';

  return {
    envelope: {
      app: APP_TAG,
      formatVersion: FORMAT_VERSION,
      kind,
      exportedAt,
      exportedFromAppVersion,
      payload: { players, sheets, groups, settings },
    },
  };
}

function validatePerKind(
  kind: ExportKind,
  counts: { sheets: number; groups: number; hasSettings: boolean },
): void {
  switch (kind) {
    case 'sheet':
      if (counts.sheets !== 1)
        throw new ParseError(`kind=sheet muss genau einen Bogen enthalten, hat ${counts.sheets}.`);
      if (counts.groups !== 0)
        throw new ParseError(`kind=sheet darf keine Gruppen enthalten, hat ${counts.groups}.`);
      if (counts.hasSettings)
        throw new ParseError('kind=sheet darf keine Settings enthalten.');
      break;
    case 'group':
      if (counts.groups !== 1)
        throw new ParseError(`kind=group muss genau eine Gruppe enthalten, hat ${counts.groups}.`);
      if (counts.hasSettings)
        throw new ParseError('kind=group darf keine Settings enthalten.');
      break;
    case 'backup':
      if (!counts.hasSettings)
        throw new ParseError('kind=backup muss Settings enthalten.');
      break;
  }
}

function readArray(v: unknown): ReadonlyArray<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter((entry): entry is Record<string, unknown> => isObject(entry));
}

function readSettings(v: unknown): AppSettings | null {
  if (!isObject(v)) return null;
  return appSettingsFromJson(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test -- importParser && pnpm typecheck`

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/application/import/importParser.ts \
        __tests__/application/importParser.test.ts
git commit -m "feat(import): parse and validate export envelope"
```

---

## Task 6: importDiff

**Files:**
- Create: `src/application/import/importDiff.ts`
- Create: `__tests__/application/importDiff.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/application/importDiff.test.ts`:

```ts
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

function s(id: string, playerIds: ReadonlyArray<string>, updatedAt = epoch, groupId: string | null = null): GameSheet {
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
    const plan = buildImportPlan(envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'])], []), local);
    expect(plan.players[0]!.suggested.kind).toBe('useLocal');
  });
  test('different id, same name → mergeInto suggested', () => {
    const local: LocalState = { ...emptyLocal, players: [p('local-a', 'Anna')] };
    const plan = buildImportPlan(envelope('sheet', [p('imp-a', 'Anna')], [s('sh-1', ['imp-a', 'imp-a', 'imp-a', 'imp-a'])], []), local);
    const d = plan.players[0]!;
    expect(d.suggested.kind).toBe('mergeInto');
    expect(d.suggested.kind === 'mergeInto' && d.suggested.localId).toBe('local-a');
  });
  test('different id, no name match → addAsNew suggested', () => {
    const local: LocalState = { ...emptyLocal, players: [p('local-a', 'Anna')] };
    const plan = buildImportPlan(envelope('sheet', [p('imp-z', 'Zoe')], [s('sh-1', ['imp-z', 'imp-z', 'imp-z', 'imp-z'])], []), local);
    expect(plan.players[0]!.suggested.kind).toBe('addAsNew');
  });
});

describe('buildImportPlan — sheets', () => {
  test('new id → addAsNew suggested', () => {
    const plan = buildImportPlan(envelope('sheet', [p('a', 'Anna')], [s('sh-new', ['a', 'a', 'a', 'a'])], []), emptyLocal);
    expect(plan.sheets[0]!.suggested.kind).toBe('addAsNew');
  });
  test('existing id, same updatedAt → useLocal', () => {
    const local: LocalState = { ...emptyLocal, sheets: [s('sh-1', ['a', 'a', 'a', 'a'], epoch)] };
    const plan = buildImportPlan(envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'], epoch)], []), local);
    expect(plan.sheets[0]!.suggested.kind).toBe('useLocal');
  });
  test('existing id, imported newer → replaceLocal suggested', () => {
    const local: LocalState = { ...emptyLocal, sheets: [s('sh-1', ['a', 'a', 'a', 'a'], epoch)] };
    const plan = buildImportPlan(envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'], newer)], []), local);
    expect(plan.sheets[0]!.suggested.kind).toBe('replaceLocal');
  });
  test('existing id, imported older → keepLocal suggested', () => {
    const local: LocalState = { ...emptyLocal, sheets: [s('sh-1', ['a', 'a', 'a', 'a'], newer)] };
    const plan = buildImportPlan(envelope('sheet', [p('a', 'Anna')], [s('sh-1', ['a', 'a', 'a', 'a'], epoch)], []), local);
    expect(plan.sheets[0]!.suggested.kind).toBe('keepLocal');
  });
});

describe('buildImportPlan — groups', () => {
  test('new id → addAsNew', () => {
    const plan = buildImportPlan(envelope('group', [], [], [g('grp-new', 'X')]), emptyLocal);
    expect(plan.groups[0]!.suggested.kind).toBe('addAsNew');
  });
  test('existing id, imported newer → replaceLocal', () => {
    const local: LocalState = { ...emptyLocal, groups: [g('grp-1', 'Old', epoch)] };
    const plan = buildImportPlan(envelope('group', [], [], [g('grp-1', 'New', newer)]), local);
    expect(plan.groups[0]!.suggested.kind).toBe('replaceLocal');
  });
});

describe('buildImportPlan — settings (backup only)', () => {
  test('null payload settings → no settings decision', () => {
    const plan = buildImportPlan(envelope('sheet', [], [s('sh-1', ['a', 'a', 'a', 'a'])], []), emptyLocal);
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
    // Build a plan, then mutate the player decision to skip and re-run.
    // The helper exposes a re-resolve method; alternatively re-call
    // buildImportPlan after setting a player override (see implementation).
    const parsed = envelope('sheet', [p('imp-a', 'NewName')], [s('sh-1', ['imp-a', 'imp-a', 'imp-a', 'imp-a'])], []);
    const planA = buildImportPlan(parsed, emptyLocal);
    expect(planA.sheets[0]!.suggested.kind).toBe('addAsNew');
    const planB = buildImportPlan(parsed, emptyLocal, { playerOverrides: { 'imp-a': { kind: 'skip' } } });
    expect(planB.sheets[0]!.suggested.kind).toBe('skip');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- importDiff`

Expected: module-not-found.

- [ ] **Step 3: Implement**

Create `src/application/import/importDiff.ts`:

```ts
import type { AppSettings } from '@/domain/models/appSettings';
import { playerDisplayName, type Player } from '@/domain/models/player';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import type { ParsedExportFile } from '@/application/import/importParser';

export type PlayerAction =
  | { kind: 'useLocal'; localId: string }
  | { kind: 'mergeInto'; localId: string }
  | { kind: 'addAsNew' }
  | { kind: 'skip' };

export interface PlayerDecision {
  readonly imported: Player;
  readonly suggested: PlayerAction;
  readonly localMatchById: string | null;
  readonly localMatchByName: string | null;
}

export type SheetAction =
  | { kind: 'useLocal' }
  | { kind: 'addAsNew' }
  | { kind: 'replaceLocal' }
  | { kind: 'keepLocal' }
  | { kind: 'addCopy' }
  | { kind: 'skip' };

export interface SheetDecision {
  readonly imported: GameSheet;
  readonly localExisting: GameSheet | null;
  readonly suggested: SheetAction;
}

export type GroupAction = SheetAction;

export interface GroupDecision {
  readonly imported: SheetGroup;
  readonly localExisting: SheetGroup | null;
  readonly suggested: GroupAction;
}

export type SettingsAction = 'replace' | 'keep';

export interface ImportPlan {
  readonly players: ReadonlyArray<PlayerDecision>;
  readonly groups: ReadonlyArray<GroupDecision>;
  readonly sheets: ReadonlyArray<SheetDecision>;
  readonly settings: { suggested: SettingsAction } | null;
}

export interface LocalState {
  readonly players: ReadonlyArray<Player>;
  readonly groups: ReadonlyArray<SheetGroup>;
  readonly sheets: ReadonlyArray<GameSheet>;
  readonly settings: AppSettings;
}

export interface BuildPlanOptions {
  readonly playerOverrides?: Record<string, PlayerAction>;
}

/**
 * Berechnet pro Entitaet eine vorgeschlagene Aktion. Pure Funktion.
 * `playerOverrides` erlaubt es, eine bereits getroffene Nutzer-Entscheidung
 * (z.B. `skip`) durchzureichen, damit der Sheets-Cascade beruecksichtigt
 * wird, ohne dass die UI alles neu durchrechnen muss.
 */
export function buildImportPlan(
  parsed: ParsedExportFile,
  local: LocalState,
  options: BuildPlanOptions = {},
): ImportPlan {
  const localPlayersById = new Map(local.players.map((p) => [p.id, p] as const));
  const localPlayersByName = new Map(
    local.players.map((p) => [playerDisplayName(p).toLowerCase(), p] as const),
  );
  const localSheetsById = new Map(local.sheets.map((s) => [s.id, s] as const));
  const localGroupsById = new Map(local.groups.map((g) => [g.id, g] as const));

  const players: PlayerDecision[] = parsed.envelope.payload.players.map((imp) => {
    const byId = localPlayersById.get(imp.id) ?? null;
    const byName = localPlayersByName.get(playerDisplayName(imp).toLowerCase()) ?? null;
    const override = options.playerOverrides?.[imp.id];
    const suggested: PlayerAction =
      override ??
      (byId !== null
        ? { kind: 'useLocal', localId: byId.id }
        : byName !== null
          ? { kind: 'mergeInto', localId: byName.id }
          : { kind: 'addAsNew' });
    return {
      imported: imp,
      suggested,
      localMatchById: byId?.id ?? null,
      localMatchByName: byName?.id ?? null,
    };
  });

  const skippedPlayerIds = new Set(
    players.filter((d) => d.suggested.kind === 'skip').map((d) => d.imported.id),
  );

  const groups: GroupDecision[] = parsed.envelope.payload.groups.map((imp) => ({
    imported: imp,
    localExisting: localGroupsById.get(imp.id) ?? null,
    suggested: suggestForRecord(localGroupsById.get(imp.id) ?? null, imp.updatedAt),
  }));

  const sheets: SheetDecision[] = parsed.envelope.payload.sheets.map((imp) => {
    const blocked = imp.playerIds.some((id) => skippedPlayerIds.has(id));
    if (blocked) {
      return {
        imported: imp,
        localExisting: localSheetsById.get(imp.id) ?? null,
        suggested: { kind: 'skip' },
      };
    }
    return {
      imported: imp,
      localExisting: localSheetsById.get(imp.id) ?? null,
      suggested: suggestForRecord(localSheetsById.get(imp.id) ?? null, imp.updatedAt),
    };
  });

  const importedSettings = parsed.envelope.payload.settings;
  const settings = importedSettings === null
    ? null
    : {
        suggested: settingsEqual(importedSettings, local.settings)
          ? ('keep' as const)
          : ('replace' as const),
      };

  return { players, groups, sheets, settings };
}

function suggestForRecord(
  existing: { updatedAt: Date } | null,
  importedUpdatedAt: Date,
): SheetAction {
  if (existing === null) return { kind: 'addAsNew' };
  if (existing.updatedAt.getTime() === importedUpdatedAt.getTime()) {
    return { kind: 'useLocal' };
  }
  return importedUpdatedAt > existing.updatedAt
    ? { kind: 'replaceLocal' }
    : { kind: 'keepLocal' };
}

function settingsEqual(a: AppSettings, b: AppSettings): boolean {
  return a.defaultStackingMode === b.defaultStackingMode && a.language === b.language;
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test -- importDiff && pnpm typecheck`

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/application/import/importDiff.ts \
        __tests__/application/importDiff.test.ts
git commit -m "feat(import): build per-entity action plan with skip cascade"
```

---

## Task 7: importApply

**Files:**
- Create: `src/application/import/importApply.ts`
- Create: `__tests__/application/importApply.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/application/importApply.test.ts`:

```ts
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
function s(id: string, playerIds: ReadonlyArray<string>, groupId: string | null = null): GameSheet {
  return {
    id, title: null, createdAt: epoch, updatedAt: epoch,
    playerIds, rounds: [], dirty: false, stackingModeOverride: null, groupId,
  };
}
function g(id: string, name: string): SheetGroup {
  return { id, name, type: GroupType.season, createdAt: epoch, updatedAt: epoch, dirty: false };
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
        { imported: p('imp-a', 'Anna'), suggested: { kind: 'addAsNew' }, localMatchById: null, localMatchByName: null },
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
        { imported: p('imp-a', 'Anna'), suggested: { kind: 'mergeInto', localId: 'local-a' }, localMatchById: null, localMatchByName: 'local-a' },
        { imported: p('local-b', 'Ben'), suggested: { kind: 'useLocal', localId: 'local-b' }, localMatchById: 'local-b', localMatchByName: 'local-b' },
        { imported: p('local-c', 'Carla'), suggested: { kind: 'useLocal', localId: 'local-c' }, localMatchById: 'local-c', localMatchByName: 'local-c' },
        { imported: p('local-d', 'Dirk'), suggested: { kind: 'useLocal', localId: 'local-d' }, localMatchById: 'local-d', localMatchByName: 'local-d' },
      ],
      groups: [],
      sheets: [
        { imported: s('imp-sh', ['imp-a', 'local-b', 'local-c', 'local-d']), localExisting: null, suggested: { kind: 'addAsNew' } },
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
        { imported: { ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'New' }, localExisting: s('sh-1', ['a', 'b', 'c', 'd']), suggested: { kind: 'replaceLocal' } },
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
        { imported: { ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'Imported' }, localExisting: s('sh-1', ['a', 'b', 'c', 'd']), suggested: { kind: 'keepLocal' } },
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
        { imported: { ...s('sh-1', ['a', 'b', 'c', 'd']), title: 'CopyMe' }, localExisting: s('sh-1', ['a', 'b', 'c', 'd']), suggested: { kind: 'addCopy' } },
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
        { imported: s('sh-1', ['a', 'b', 'c', 'd']), localExisting: null, suggested: { kind: 'skip' } },
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
        { imported: g('grp-1', 'ImportedGroup'), localExisting: g('grp-1', 'LocalGroup'), suggested: { kind: 'addCopy' } },
      ],
      sheets: [
        { imported: s('sh-1', ['a', 'b', 'c', 'd'], 'grp-1'), localExisting: null, suggested: { kind: 'addAsNew' } },
      ],
      settings: null,
    };
    await applyImportPlan(plan);
    const stored = await repositories.gameSheet().load('sh-1');
    expect(stored?.groupId).not.toBe('grp-1');
    expect(stored?.groupId).toBeTruthy();
    const copyGroup = (await repositories.sheetGroup().loadAll()).find((g) => g.name === 'ImportedGroup');
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
    // Wire imported settings into the plan-application flow.
    // applyImportPlan reads the settings from a second argument when settings != null.
    // See implementation in next step for signature.
    const imported = { defaultStackingMode: BockStackingMode.doppelbock, language: 'de' as const };
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
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- importApply`

Expected: module-not-found.

- [ ] **Step 3: Implement**

Create `src/application/import/importApply.ts`:

```ts
import { newId } from '@/core/id';
import type { AppSettings } from '@/domain/models/appSettings';
import type { GameSheet } from '@/domain/models/gameSheet';
import { copyGameSheet } from '@/domain/models/gameSheet';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import { copySheetGroup } from '@/domain/models/sheetGroup';
import { repositories } from '@/application/stores/repositories';
import type { ImportPlan } from '@/application/import/importDiff';

export interface ImportResult {
  readonly playersAdded: number;
  readonly playersMerged: number;
  readonly groupsAdded: number;
  readonly groupsReplaced: number;
  readonly groupsCopied: number;
  readonly sheetsAdded: number;
  readonly sheetsReplaced: number;
  readonly sheetsCopied: number;
  readonly sheetsSkipped: number;
  readonly settingsReplaced: boolean;
}

export interface ApplyOptions {
  /**
   * Bei `plan.settings !== null` muessen die importierten Settings hier
   * mitgegeben werden — die landen sonst nicht im Plan, weil der `Plan`
   * sie nicht traegt (kein Reason, sie zu duplizieren). UI ruft das so
   * auf, da sie den Envelope ohnehin in der Hand hat.
   */
  readonly settings?: AppSettings;
}

export async function applyImportPlan(
  plan: ImportPlan,
  options: ApplyOptions = {},
): Promise<ImportResult> {
  const counters: Mutable<ImportResult> = {
    playersAdded: 0,
    playersMerged: 0,
    groupsAdded: 0,
    groupsReplaced: 0,
    groupsCopied: 0,
    sheetsAdded: 0,
    sheetsReplaced: 0,
    sheetsCopied: 0,
    sheetsSkipped: 0,
    settingsReplaced: false,
  };

  // 1) Players
  const playerRemap = new Map<string, string>();
  for (const d of plan.players) {
    const action = d.suggested;
    switch (action.kind) {
      case 'useLocal':
        playerRemap.set(d.imported.id, action.localId);
        break;
      case 'mergeInto':
        playerRemap.set(d.imported.id, action.localId);
        counters.playersMerged += 1;
        break;
      case 'addAsNew':
        await repositories.player().save(d.imported);
        playerRemap.set(d.imported.id, d.imported.id);
        counters.playersAdded += 1;
        break;
      case 'skip':
        // no map entry; cascaded sheets are already 'skip'
        break;
    }
  }

  // 2) Settings
  if (plan.settings !== null && options.settings !== undefined) {
    if (plan.settings.suggested === 'replace') {
      await repositories.settings().save(options.settings);
      counters.settingsReplaced = true;
    }
  }

  // 3) Groups
  const groupRemap = new Map<string, string>();
  for (const d of plan.groups) {
    const action = d.suggested;
    switch (action.kind) {
      case 'useLocal':
        groupRemap.set(d.imported.id, d.imported.id);
        break;
      case 'addAsNew':
        await repositories.sheetGroup().save(d.imported);
        groupRemap.set(d.imported.id, d.imported.id);
        counters.groupsAdded += 1;
        break;
      case 'replaceLocal':
        await repositories.sheetGroup().save(d.imported);
        groupRemap.set(d.imported.id, d.imported.id);
        counters.groupsReplaced += 1;
        break;
      case 'keepLocal':
        groupRemap.set(d.imported.id, d.imported.id);
        break;
      case 'addCopy': {
        const fresh = copyGroupWithNewId(d.imported);
        await repositories.sheetGroup().save(fresh);
        groupRemap.set(d.imported.id, fresh.id);
        counters.groupsCopied += 1;
        break;
      }
      case 'skip':
        // no map entry; sheets keep groupId raw, gets nulled below
        break;
    }
  }

  // 4) Sheets
  for (const d of plan.sheets) {
    const action = d.suggested;
    if (action.kind === 'skip' || action.kind === 'keepLocal' || action.kind === 'useLocal') {
      if (action.kind === 'skip') counters.sheetsSkipped += 1;
      continue;
    }
    const remappedPlayerIds = d.imported.playerIds.map((id) => playerRemap.get(id) ?? id);
    const remappedGroupId =
      d.imported.groupId === null ? null : (groupRemap.get(d.imported.groupId) ?? null);
    switch (action.kind) {
      case 'addAsNew':
      case 'replaceLocal': {
        const next = copyGameSheet(d.imported, {
          playerIds: remappedPlayerIds,
          groupId: remappedGroupId,
          updatedAt: d.imported.updatedAt,
          dirty: false,
        });
        // copyGameSheet defaults updatedAt to new Date() when omitted, so we
        // pass it explicitly to preserve the imported timestamp.
        const persisted: GameSheet = { ...next, id: d.imported.id };
        await repositories.gameSheet().save(persisted);
        if (action.kind === 'addAsNew') counters.sheetsAdded += 1;
        else counters.sheetsReplaced += 1;
        break;
      }
      case 'addCopy': {
        const persisted: GameSheet = {
          ...d.imported,
          id: newId(),
          playerIds: remappedPlayerIds,
          groupId: remappedGroupId,
        };
        await repositories.gameSheet().save(persisted);
        counters.sheetsCopied += 1;
        break;
      }
    }
  }

  return counters;
}

function copyGroupWithNewId(g: SheetGroup): SheetGroup {
  return copySheetGroup({ ...g, id: newId() }, { updatedAt: g.updatedAt, dirty: g.dirty });
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
```

- [ ] **Step 4: Verify**

Run: `pnpm test -- importApply && pnpm typecheck`

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/application/import/importApply.ts \
        __tests__/application/importApply.test.ts
git commit -m "feat(import): apply plan with player and group remap"
```

---

## Task 8: ImportReviewScreen + Import entry + roundtrip test

**Files:**
- Create: `src/presentation/screens/ImportReviewScreen.tsx`
- Create: `app/import/review.tsx`
- Modify: `app/_layout.tsx` — register the route
- Modify: `src/presentation/screens/SettingsScreen.tsx` — add Import button + document picker flow
- Modify: `src/presentation/i18n/locales/de.ts` — review-screen labels
- Modify: `src/presentation/i18n/locales/en.ts` — same
- Create: `__tests__/integration/exportImportRoundtrip.test.ts`

- [ ] **Step 1: Add i18n labels for the review screen (DE)**

Add the following keys inside the `exportImport` block in `de.ts`:

```ts
reviewTitle: 'Import-Vorschau',
sectionPlayers: 'Spieler',
sectionGroups: 'Gruppen',
sectionSheets: 'Spielbögen',
sectionSettings: 'Einstellungen',
bulkTakeImported: 'Alle importierten nehmen',
bulkKeepLocal: 'Alle lokalen behalten',
bulkSkip: 'Alle überspringen',
actionUseLocal: 'Lokal behalten',
actionMergeInto: 'Zusammenführen mit {{name}}',
actionAddAsNew: 'Neu anlegen',
actionReplaceLocal: 'Lokales überschreiben',
actionKeepLocal: 'Lokales behalten',
actionAddCopy: 'Als Kopie',
actionSkip: 'Überspringen',
actionReplaceSettings: 'Importierte Einstellungen übernehmen',
actionKeepSettings: 'Lokale Einstellungen behalten',
applyButton: 'Übernehmen',
cancelButton: 'Abbrechen',
importFailed: 'Import fehlgeschlagen',
importSummary: '{{added}} hinzugefügt, {{replaced}} ersetzt, {{skipped}} übersprungen.',
skipDependentSheet: 'Abhängiger Spieler übersprungen',
pickerCancelled: 'Import abgebrochen',
```

- [ ] **Step 2: Add the same keys in EN**

```ts
reviewTitle: 'Import preview',
sectionPlayers: 'Players',
sectionGroups: 'Groups',
sectionSheets: 'Sheets',
sectionSettings: 'Settings',
bulkTakeImported: 'Take all imported',
bulkKeepLocal: 'Keep all local',
bulkSkip: 'Skip all',
actionUseLocal: 'Keep local',
actionMergeInto: 'Merge into {{name}}',
actionAddAsNew: 'Add as new',
actionReplaceLocal: 'Replace local',
actionKeepLocal: 'Keep local',
actionAddCopy: 'Add as copy',
actionSkip: 'Skip',
actionReplaceSettings: 'Apply imported settings',
actionKeepSettings: 'Keep local settings',
applyButton: 'Apply',
cancelButton: 'Cancel',
importFailed: 'Import failed',
importSummary: '{{added}} added, {{replaced}} replaced, {{skipped}} skipped.',
skipDependentSheet: 'Skipped — dependent player skipped',
pickerCancelled: 'Import cancelled',
```

Run: `pnpm test -- localesShape` — green.

- [ ] **Step 3: Register the review route**

Edit `app/_layout.tsx`. Inside the `<Stack>` block (around the existing `Stack.Screen` entries), add:

```tsx
<Stack.Screen
  name="import/review"
  options={{ title: t('exportImport.reviewTitle') }}
/>
```

- [ ] **Step 4: Create the route wrapper**

Create `app/import/review.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { ImportReviewScreen } from '@/presentation/screens/ImportReviewScreen';

export default function ImportReviewRoute() {
  const { fileUri } = useLocalSearchParams<{ fileUri: string }>();
  if (typeof fileUri !== 'string') {
    return null;
  }
  return <ImportReviewScreen fileUri={fileUri} />;
}
```

- [ ] **Step 5: Create the review screen**

Create `src/presentation/screens/ImportReviewScreen.tsx`:

```tsx
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  HelperText,
  List,
  Menu,
  Text,
} from 'react-native-paper';

import {
  buildImportPlan,
  type GroupAction,
  type ImportPlan,
  type LocalState,
  type PlayerAction,
  type PlayerDecision,
  type SettingsAction,
  type SheetAction,
  type SheetDecision,
} from '@/application/import/importDiff';
import { applyImportPlan } from '@/application/import/importApply';
import {
  parseExportFile,
  ParseError,
  type ParsedExportFile,
} from '@/application/import/importParser';
import { repositories } from '@/application/stores/repositories';
import type { Player } from '@/domain/models/player';
import { useTranslation } from '@/presentation/i18n/useTranslation';

interface PreparedState {
  parsed: ParsedExportFile;
  initialPlan: ImportPlan;
  local: LocalState;
}

export interface ImportReviewScreenProps {
  fileUri: string;
}

export function ImportReviewScreen({ fileUri }: ImportReviewScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [playerActions, setPlayerActions] = useState<Record<string, PlayerAction>>({});
  const [sheetActions, setSheetActions] = useState<Record<string, SheetAction>>({});
  const [groupActions, setGroupActions] = useState<Record<string, GroupAction>>({});
  const [settingsAction, setSettingsAction] = useState<SettingsAction | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const text = await FileSystem.readAsStringAsync(fileUri);
        const parsed = parseExportFile(text);
        const local: LocalState = {
          players: await repositories.player().loadAll(),
          groups: await repositories.sheetGroup().loadAll(),
          sheets: await repositories.gameSheet().loadAll(),
          settings: await repositories.settings().load(),
        };
        const initialPlan = buildImportPlan(parsed, local);
        if (cancelled) return;
        setPrepared({ parsed, initialPlan, local });
        setPlayerActions(
          Object.fromEntries(initialPlan.players.map((d) => [d.imported.id, d.suggested])),
        );
        setSheetActions(
          Object.fromEntries(initialPlan.sheets.map((d) => [d.imported.id, d.suggested])),
        );
        setGroupActions(
          Object.fromEntries(initialPlan.groups.map((d) => [d.imported.id, d.suggested])),
        );
        setSettingsAction(initialPlan.settings?.suggested ?? null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ParseError ? e.message : `${e}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri]);

  const recomputedPlan = useMemo<ImportPlan | null>(() => {
    if (prepared === null) return null;
    // Re-run buildImportPlan with the user's current player overrides so the
    // skip-cascade is reflected in sheet suggestions. Group/Settings rows are
    // taken straight from the initial plan — their suggestions don't depend
    // on player decisions.
    const re = buildImportPlan(prepared.parsed, prepared.local, {
      playerOverrides: playerActions,
    });
    return {
      ...prepared.initialPlan,
      sheets: prepared.initialPlan.sheets.map((d) => ({
        ...d,
        suggested: re.sheets.find((s) => s.imported.id === d.imported.id)?.suggested ?? d.suggested,
      })),
    };
  }, [prepared, playerActions]);

  if (error !== null) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text variant="titleMedium">{t('exportImport.importFailed')}</Text>
        <HelperText type="error" visible>
          {error}
        </HelperText>
        <Button mode="contained-tonal" onPress={() => router.back()}>
          {t('exportImport.cancelButton')}
        </Button>
      </View>
    );
  }

  if (prepared === null || recomputedPlan === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  async function onApply() {
    if (prepared === null) return;
    setApplying(true);
    const plan: ImportPlan = {
      players: prepared.initialPlan.players.map((d) => ({
        ...d,
        suggested: playerActions[d.imported.id] ?? d.suggested,
      })),
      groups: prepared.initialPlan.groups.map((d) => ({
        ...d,
        suggested: groupActions[d.imported.id] ?? d.suggested,
      })),
      sheets: (recomputedPlan?.sheets ?? prepared.initialPlan.sheets).map((d) => ({
        ...d,
        suggested: sheetActions[d.imported.id] ?? d.suggested,
      })),
      settings:
        prepared.initialPlan.settings === null
          ? null
          : { suggested: settingsAction ?? prepared.initialPlan.settings.suggested },
    };
    try {
      await applyImportPlan(plan, {
        settings: prepared.parsed.envelope.payload.settings ?? undefined,
      });
      router.replace('/');
    } catch (e) {
      setError(`${e}`);
    } finally {
      setApplying(false);
    }
  }

  const visiblePlayers = recomputedPlan.players.filter(
    (d) => d.suggested.kind !== 'useLocal',
  );
  const visibleGroups = recomputedPlan.groups.filter(
    (d) => d.suggested.kind !== 'useLocal',
  );
  const visibleSheets = recomputedPlan.sheets.filter(
    (d) => d.suggested.kind !== 'useLocal',
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 16, paddingBottom: 80 }}>
      {visiblePlayers.length > 0 && (
        <Card>
          <Card.Title title={t('exportImport.sectionPlayers')} />
          <Card.Content>
            {visiblePlayers.map((d, i) => (
              <View key={d.imported.id}>
                {i > 0 && <Divider />}
                <PlayerRow
                  decision={d}
                  action={playerActions[d.imported.id] ?? d.suggested}
                  localPool={prepared.local.players}
                  onChange={(a) =>
                    setPlayerActions((prev) => ({ ...prev, [d.imported.id]: a }))
                  }
                />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {visibleGroups.length > 0 && (
        <Card>
          <Card.Title title={t('exportImport.sectionGroups')} />
          <Card.Content>
            {visibleGroups.map((d, i) => (
              <View key={d.imported.id}>
                {i > 0 && <Divider />}
                <SheetOrGroupRow
                  title={d.imported.name}
                  subtitle={null}
                  action={groupActions[d.imported.id] ?? d.suggested}
                  isExisting={d.localExisting !== null}
                  onChange={(a) =>
                    setGroupActions((prev) => ({ ...prev, [d.imported.id]: a }))
                  }
                />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {visibleSheets.length > 0 && (
        <Card>
          <Card.Title title={t('exportImport.sectionSheets')} />
          <Card.Content>
            {visibleSheets.map((d, i) => (
              <View key={d.imported.id}>
                {i > 0 && <Divider />}
                <SheetOrGroupRow
                  title={d.imported.title ?? d.imported.id}
                  subtitle={d.imported.updatedAt.toLocaleString()}
                  action={sheetActions[d.imported.id] ?? d.suggested}
                  isExisting={d.localExisting !== null}
                  isBlocked={d.suggested.kind === 'skip' && d.localExisting === null}
                  onChange={(a) =>
                    setSheetActions((prev) => ({ ...prev, [d.imported.id]: a }))
                  }
                />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {prepared.initialPlan.settings !== null && (
        <Card>
          <Card.Title title={t('exportImport.sectionSettings')} />
          <Card.Content>
            <Button
              mode={settingsAction === 'replace' ? 'contained' : 'outlined'}
              onPress={() => setSettingsAction('replace')}
              style={{ marginBottom: 8 }}
            >
              {t('exportImport.actionReplaceSettings')}
            </Button>
            <Button
              mode={settingsAction === 'keep' ? 'contained' : 'outlined'}
              onPress={() => setSettingsAction('keep')}
            >
              {t('exportImport.actionKeepSettings')}
            </Button>
          </Card.Content>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode="outlined" style={{ flex: 1 }} onPress={() => router.back()}>
          {t('exportImport.cancelButton')}
        </Button>
        <Button
          mode="contained"
          style={{ flex: 1 }}
          loading={applying}
          onPress={() => void onApply()}
        >
          {t('exportImport.applyButton')}
        </Button>
      </View>
    </ScrollView>
  );
}

function PlayerRow({
  decision,
  action,
  localPool,
  onChange,
}: {
  decision: PlayerDecision;
  action: PlayerAction;
  localPool: ReadonlyArray<Player>;
  onChange: (a: PlayerAction) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const label = describePlayerAction(action, localPool, t);
  return (
    <List.Item
      title={decision.imported.playerName}
      description={label}
      right={() => (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button onPress={() => setMenuOpen(true)} mode="text">
              {label}
            </Button>
          }
        >
          <Menu.Item
            title={t('exportImport.actionAddAsNew')}
            onPress={() => {
              onChange({ kind: 'addAsNew' });
              setMenuOpen(false);
            }}
          />
          {localPool.length > 0 && <Divider />}
          {localPool.map((p) => (
            <Menu.Item
              key={p.id}
              title={t('exportImport.actionMergeInto', { name: p.playerName })}
              onPress={() => {
                onChange({ kind: 'mergeInto', localId: p.id });
                setMenuOpen(false);
              }}
            />
          ))}
          <Divider />
          <Menu.Item
            title={t('exportImport.actionSkip')}
            onPress={() => {
              onChange({ kind: 'skip' });
              setMenuOpen(false);
            }}
          />
        </Menu>
      )}
    />
  );
}

function describePlayerAction(
  action: PlayerAction,
  localPool: ReadonlyArray<Player>,
  t: (k: string, p?: Record<string, unknown>) => string,
): string {
  switch (action.kind) {
    case 'addAsNew':
      return t('exportImport.actionAddAsNew');
    case 'mergeInto': {
      const target = localPool.find((p) => p.id === action.localId);
      return t('exportImport.actionMergeInto', { name: target?.playerName ?? action.localId });
    }
    case 'useLocal':
      return t('exportImport.actionUseLocal');
    case 'skip':
      return t('exportImport.actionSkip');
  }
}

function SheetOrGroupRow({
  title,
  subtitle,
  action,
  isExisting,
  isBlocked,
  onChange,
}: {
  title: string;
  subtitle: string | null;
  action: SheetAction;
  isExisting: boolean;
  isBlocked?: boolean;
  onChange: (a: SheetAction) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (isBlocked === true) {
    return (
      <List.Item
        title={title}
        description={t('exportImport.skipDependentSheet')}
      />
    );
  }
  return (
    <List.Item
      title={title}
      description={subtitle ?? undefined}
      right={() => (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button onPress={() => setMenuOpen(true)} mode="text">
              {describeSheetAction(action, t)}
            </Button>
          }
        >
          {isExisting ? (
            <>
              <Menu.Item title={t('exportImport.actionReplaceLocal')} onPress={() => { onChange({ kind: 'replaceLocal' }); setMenuOpen(false); }} />
              <Menu.Item title={t('exportImport.actionKeepLocal')} onPress={() => { onChange({ kind: 'keepLocal' }); setMenuOpen(false); }} />
              <Menu.Item title={t('exportImport.actionAddCopy')} onPress={() => { onChange({ kind: 'addCopy' }); setMenuOpen(false); }} />
            </>
          ) : (
            <>
              <Menu.Item title={t('exportImport.actionAddAsNew')} onPress={() => { onChange({ kind: 'addAsNew' }); setMenuOpen(false); }} />
              <Menu.Item title={t('exportImport.actionAddCopy')} onPress={() => { onChange({ kind: 'addCopy' }); setMenuOpen(false); }} />
            </>
          )}
          <Divider />
          <Menu.Item title={t('exportImport.actionSkip')} onPress={() => { onChange({ kind: 'skip' }); setMenuOpen(false); }} />
        </Menu>
      )}
    />
  );
}

function describeSheetAction(action: SheetAction, t: (k: string, p?: Record<string, unknown>) => string): string {
  switch (action.kind) {
    case 'useLocal': return t('exportImport.actionUseLocal');
    case 'addAsNew': return t('exportImport.actionAddAsNew');
    case 'replaceLocal': return t('exportImport.actionReplaceLocal');
    case 'keepLocal': return t('exportImport.actionKeepLocal');
    case 'addCopy': return t('exportImport.actionAddCopy');
    case 'skip': return t('exportImport.actionSkip');
  }
}
```


- [ ] **Step 6: Wire SettingsScreen import button**

Edit `src/presentation/screens/SettingsScreen.tsx`. Add imports:

```ts
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
```

Inside the component, declare:

```ts
const router = useRouter();
```

After the `Backup exportieren` block, add:

```tsx
<Button
  mode="contained-tonal"
  icon="import"
  onPress={() => {
    void (async () => {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled === true) return;
      const uri = res.assets?.[0]?.uri;
      if (typeof uri !== 'string') return;
      router.push({ pathname: '/import/review', params: { fileUri: uri } });
    })();
  }}
>
  {t('exportImport.importButton')}
</Button>
```

- [ ] **Step 7: Write the roundtrip integration test**

Create `__tests__/integration/exportImportRoundtrip.test.ts`:

```ts
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
function s(id: string, playerIds: ReadonlyArray<string>, groupId: string | null = null): GameSheet {
  return {
    id, title: null, createdAt: epoch, updatedAt: epoch,
    playerIds, rounds: [], dirty: false, stackingModeOverride: null, groupId,
  };
}
function g(id: string, name: string): SheetGroup {
  return { id, name, type: GroupType.season, createdAt: epoch, updatedAt: epoch, dirty: false };
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
  await repositories.settings().save({ defaultStackingMode: BockStackingMode.doppelbock, language: 'de' });

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
  await applyImportPlan(plan, { settings: parsed.envelope.payload.settings ?? undefined });

  // === Compare ===
  expect((await repositories.player().loadAll()).map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
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
  await repositories.player().save(p('a', 'Anna-Target'));   // same id, different name

  const parsed = parseExportFile(serialised);
  const local: LocalState = {
    players: await repositories.player().loadAll(),
    groups: [],
    sheets: [],
    settings: await repositories.settings().load(),
  };
  const plan = buildImportPlan(parsed, local);
  await applyImportPlan(plan, { settings: parsed.envelope.payload.settings ?? undefined });

  const annaAfter = (await repositories.player().loadAll()).find((p) => p.id === 'a');
  expect(annaAfter?.playerName).toBe('Anna-Target');
});
```

- [ ] **Step 8: Verify**

Run: `pnpm typecheck && pnpm test && pnpm lint`

Expected: all green; new tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/presentation/screens/ImportReviewScreen.tsx \
        app/import/review.tsx \
        app/_layout.tsx \
        src/presentation/screens/SettingsScreen.tsx \
        src/presentation/i18n/locales/de.ts \
        src/presentation/i18n/locales/en.ts \
        __tests__/integration/exportImportRoundtrip.test.ts
git commit -m "feat(import): review screen + document picker entry + roundtrip test"
```

---

## Final manual verification

- [ ] **Manual: install, type-check, lint, test**

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

All green.

- [ ] **Manual: real-device end-to-end**

1. Build / start: `pnpm android` (or `pnpm ios`).
2. **Single-sheet export:** open a sheet → menu → `Bogen exportieren` → OS share sheet appears → save the file (e.g. to Downloads).
3. **Group export:** Groups → per-group menu → `Gruppe exportieren` → share.
4. **Backup export:** Settings → `Backup exportieren` → share.
5. **Import on the same device:** Settings → `Import...` → pick one of the exported files.
6. Review screen shows the expected sections; player decisions default to `useLocal` (everything matches by id); apply succeeds.
7. **Import on a second device:** transfer one of the exported files (USB or email). Open Settings → Import → pick the file. Players show `mergeInto` or `addAsNew` suggestions. Apply and verify the sheet/group/backup appears.
8. Edge cases:
   - Pick a non-JSON file → `Import fehlgeschlagen` screen with readable error.
   - Pick a JSON from another app (`app !== 'doppelkopf_schreiber'`) → same error path.
   - Pick our own export but truncated → readable error.
