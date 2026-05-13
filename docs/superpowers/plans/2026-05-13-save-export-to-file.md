# Save export to file (Android SAF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second export action on Android that writes the JSON envelope to a user-chosen location via the Storage Access Framework, alongside the existing share flow. iOS is unchanged.

**Architecture:** Add a new data-layer function `saveExportToFile` next to the existing `shareExport`. Three screens (`SheetScreen`, `GroupManagementScreen`, `SettingsScreen`) render a second action on Android only, gated by `Platform.OS === 'android'`. New i18n keys for the Android-specific share/save labels keep iOS labels untouched.

**Tech Stack:** React Native 0.81, Expo 54, `expo-file-system@19` (legacy entry, with `StorageAccessFramework`), `react-native-paper` (`Menu.Item`, `Button`), Jest + jest-expo.

**Spec:** [`docs/superpowers/specs/2026-05-13-save-export-to-file-design.md`](../specs/2026-05-13-save-export-to-file-design.md)

---

### Task 1: i18n keys for share and save labels

**Files:**
- Modify: `src/presentation/i18n/locales/de.ts:255-274`
- Modify: `src/presentation/i18n/locales/en.ts:257-276`
- Test: `__tests__/presentation/i18n/localesShape.test.ts` (existing parity test must pass)

- [ ] **Step 1: Add six new keys to `de.ts`**

In the `exportImport` block, after `exportBackupButton`, insert:

```ts
    shareSheetMenu: 'Bogen teilen...',
    shareGroupMenu: 'Gruppe teilen...',
    shareBackupButton: 'Backup teilen',
    saveSheetMenu: 'Bogen speichern unter...',
    saveGroupMenu: 'Gruppe speichern unter...',
    saveBackupButton: 'Backup speichern unter...',
```

- [ ] **Step 2: Add the same six keys to `en.ts`**

In the `exportImport` block, after `exportBackupButton`, insert:

```ts
    shareSheetMenu: 'Share sheet...',
    shareGroupMenu: 'Share group...',
    shareBackupButton: 'Share backup',
    saveSheetMenu: 'Save sheet...',
    saveGroupMenu: 'Save group...',
    saveBackupButton: 'Save backup...',
```

- [ ] **Step 3: Run the parity test**

Run: `pnpm test -- localesShape`
Expected: PASS — both locale objects have identical key sets.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS — i18n key types are inferred from `de`, so the new keys are available everywhere via `t(...)`.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/i18n/locales/de.ts src/presentation/i18n/locales/en.ts
git commit -m "feat(i18n): add share/save export labels for Android"
```

---

### Task 2: Data-layer `saveExportToFile` via SAF (TDD)

**Files:**
- Create: `__tests__/data/fileShare.test.ts`
- Modify: `src/data/export/fileShare.ts`

The new function asks the user (via SAF) for a directory, creates a file there, writes the pretty-printed envelope JSON, and returns the resulting content URI. On user-cancel it returns `{ status: 'cancelled' }` without writing.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/data/fileShare.test.ts` with this exact content:

```ts
/**
 * Tests fuer saveExportToFile mit gemocktem expo-file-system/legacy.
 * Pruefen: cancelled-Pfad schreibt nicht; saved-Pfad ruft SAF korrekt
 * und schreibt die pretty-printed Envelope-JSON.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { saveExportToFile } from '@/data/export/fileShare';
import type { ExportFile } from '@/application/export/exportTypes';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-file-system/legacy', () => {
  return {
    StorageAccessFramework: {
      requestDirectoryPermissionsAsync: jest.fn(),
      createFileAsync: jest.fn(),
    },
    writeAsStringAsync: jest.fn(),
  };
});

const saf = (FileSystem as unknown as {
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.Mock;
    createFileAsync: jest.Mock;
  };
}).StorageAccessFramework;
const writeAsStringAsync = (FileSystem as unknown as {
  writeAsStringAsync: jest.Mock;
}).writeAsStringAsync;

function makeFile(): ExportFile {
  return {
    envelope: {
      app: 'doppelkopf_schreiber',
      formatVersion: 1,
      kind: 'sheet',
      exportedAt: '2026-05-13T10:00:00.000Z',
      exportedFromAppVersion: '0.1.0',
      payload: { players: [], sheets: [], groups: [], settings: null },
    },
    suggestedFilename: 'bockzettel-test-2026-05-13.json',
  };
}

beforeEach(() => {
  saf.requestDirectoryPermissionsAsync.mockReset();
  saf.createFileAsync.mockReset();
  writeAsStringAsync.mockReset();
});

describe('saveExportToFile', () => {
  test('cancelled permission returns cancelled and writes nothing', async () => {
    saf.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: false,
      directoryUri: '',
    });

    const result = await saveExportToFile(makeFile());

    expect(result).toEqual({ status: 'cancelled' });
    expect(saf.createFileAsync).not.toHaveBeenCalled();
    expect(writeAsStringAsync).not.toHaveBeenCalled();
  });

  test('granted permission writes envelope JSON and returns saved uri', async () => {
    saf.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: 'content://com.android.externalstorage/tree/primary%3ADownload',
    });
    saf.createFileAsync.mockResolvedValue(
      'content://com.android.externalstorage/tree/primary%3ADownload/document/primary%3ADownload%2Fbockzettel-test-2026-05-13.json',
    );

    const file = makeFile();
    const result = await saveExportToFile(file);

    expect(saf.createFileAsync).toHaveBeenCalledWith(
      'content://com.android.externalstorage/tree/primary%3ADownload',
      'bockzettel-test-2026-05-13.json',
      'application/json',
    );

    expect(writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [writtenUri, writtenBody] = writeAsStringAsync.mock.calls[0];
    expect(writtenUri).toBe(
      'content://com.android.externalstorage/tree/primary%3ADownload/document/primary%3ADownload%2Fbockzettel-test-2026-05-13.json',
    );
    expect(JSON.parse(writtenBody)).toEqual(file.envelope);
    expect(writtenBody).toBe(JSON.stringify(file.envelope, null, 2));

    expect(result).toEqual({
      status: 'saved',
      uri: 'content://com.android.externalstorage/tree/primary%3ADownload/document/primary%3ADownload%2Fbockzettel-test-2026-05-13.json',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- fileShare`
Expected: FAIL — `saveExportToFile` is not exported from `@/data/export/fileShare`.

- [ ] **Step 3: Implement `saveExportToFile` in `src/data/export/fileShare.ts`**

Replace the file content with:

```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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

export type SaveExportResult =
  | { status: 'saved'; uri: string }
  | { status: 'cancelled' };

/**
 * Android-only: oeffnet den Storage-Access-Framework-Verzeichnis-Picker,
 * legt im gewaehlten Verzeichnis eine neue Datei an und schreibt den
 * pretty-printed Envelope hinein. Bricht der User ab, wird nichts
 * geschrieben.
 */
export async function saveExportToFile(
  file: ExportFile,
): Promise<SaveExportResult> {
  if (Platform.OS !== 'android') {
    throw new Error('saveExportToFile ist nur unter Android verfuegbar.');
  }

  const permissions =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    return { status: 'cancelled' };
  }

  const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    file.suggestedFilename,
    'application/json',
  );

  const json = JSON.stringify(file.envelope, null, 2);
  await FileSystem.writeAsStringAsync(newUri, json);

  return { status: 'saved', uri: newUri };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- fileShare`
Expected: PASS — both `cancelled` and `saved` paths green.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add __tests__/data/fileShare.test.ts src/data/export/fileShare.ts
git commit -m "feat(export): saveExportToFile via Android Storage Access Framework"
```

---

### Task 3: Wire `SheetScreen` for share+save on Android

**Files:**
- Modify: `src/presentation/screens/SheetScreen.tsx:1-50` (imports), `:243-256` (menu item area)

- [ ] **Step 1: Add `Platform` to the `react-native` import**

In [SheetScreen.tsx](src/presentation/screens/SheetScreen.tsx#L3), find:

```ts
import { ScrollView, View } from 'react-native';
```

Replace with:

```ts
import { Platform, ScrollView, View } from 'react-native';
```

- [ ] **Step 2: Add `saveExportToFile` to the fileShare import**

Find:

```ts
import { shareExport } from '@/data/export/fileShare';
```

Replace with:

```ts
import { saveExportToFile, shareExport } from '@/data/export/fileShare';
```

- [ ] **Step 3: Replace the single export menu item with platform-aware share + save items**

In [SheetScreen.tsx](src/presentation/screens/SheetScreen.tsx#L243-L256), find:

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

Replace with:

```tsx
                <Menu.Item
                  title={
                    Platform.OS === 'android'
                      ? t('exportImport.shareSheetMenu')
                      : t('exportImport.exportSheetMenu')
                  }
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
                {Platform.OS === 'android' && (
                  <Menu.Item
                    title={t('exportImport.saveSheetMenu')}
                    onPress={() => {
                      setMenuOpen(false);
                      void (async () => {
                        try {
                          const file = await exportSheet(sheet.id);
                          await saveExportToFile(file);
                        } catch (e) {
                          console.error(t('exportImport.exportFailed'), e);
                        }
                      })();
                    }}
                  />
                )}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — no behavioural test for SheetScreen covers this menu, the change is mechanical.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/screens/SheetScreen.tsx
git commit -m "feat(sheet): \"Bogen speichern unter…\" entry on Android"
```

---

### Task 4: Wire `GroupManagementScreen` for share+save on Android

**Files:**
- Modify: `src/presentation/screens/GroupManagementScreen.tsx:1-25` (imports), `:155-168` (menu item area)

- [ ] **Step 1: Add `Platform` to the `react-native` import**

In [GroupManagementScreen.tsx](src/presentation/screens/GroupManagementScreen.tsx#L2), find:

```ts
import { FlatList, View } from 'react-native';
```

Replace with:

```ts
import { FlatList, Platform, View } from 'react-native';
```

- [ ] **Step 2: Add `saveExportToFile` to the fileShare import**

Find:

```ts
import { shareExport } from '@/data/export/fileShare';
```

Replace with:

```ts
import { saveExportToFile, shareExport } from '@/data/export/fileShare';
```

- [ ] **Step 3: Replace the single export menu item with platform-aware share + save items**

In [GroupManagementScreen.tsx](src/presentation/screens/GroupManagementScreen.tsx#L155-L168), find:

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

Replace with:

```tsx
                    <Menu.Item
                      title={
                        Platform.OS === 'android'
                          ? t('exportImport.shareGroupMenu')
                          : t('exportImport.exportGroupMenu')
                      }
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
                    {Platform.OS === 'android' && (
                      <Menu.Item
                        title={t('exportImport.saveGroupMenu')}
                        onPress={() => {
                          setMenuForId(null);
                          void (async () => {
                            try {
                              const file = await exportGroup(g.id);
                              await saveExportToFile(file);
                            } catch (e) {
                              console.error(t('exportImport.exportFailed'), e);
                            }
                          })();
                        }}
                      />
                    )}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/screens/GroupManagementScreen.tsx
git commit -m "feat(groups): \"Gruppe speichern unter…\" entry on Android"
```

---

### Task 5: Wire `SettingsScreen` for share+save backup on Android

**Files:**
- Modify: `src/presentation/screens/SettingsScreen.tsx:1-15` (imports), `:83-100` (backup section)

`SettingsScreen` uses `Button` (not `Menu.Item`) for the backup export. The save action becomes a second button.

- [ ] **Step 1: Add `Platform` to the `react-native` import**

In [SettingsScreen.tsx](src/presentation/screens/SettingsScreen.tsx#L2), find:

```ts
import { ScrollView, View } from 'react-native';
```

Replace with:

```ts
import { Platform, ScrollView, View } from 'react-native';
```

- [ ] **Step 2: Add `saveExportToFile` to the fileShare import**

Find:

```ts
import { shareExport } from '@/data/export/fileShare';
```

Replace with:

```ts
import { saveExportToFile, shareExport } from '@/data/export/fileShare';
```

- [ ] **Step 3: Replace the single backup-export button with share + save buttons**

In [SettingsScreen.tsx](src/presentation/screens/SettingsScreen.tsx#L83-L100), find:

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
```

Replace with:

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
          {Platform.OS === 'android'
            ? t('exportImport.shareBackupButton')
            : t('exportImport.exportBackupButton')}
        </Button>
        {Platform.OS === 'android' && (
          <Button
            mode="contained-tonal"
            icon="content-save"
            onPress={() => {
              void (async () => {
                try {
                  const file = await exportBackup();
                  await saveExportToFile(file);
                } catch (e) {
                  console.error(t('exportImport.exportFailed'), e);
                }
              })();
            }}
          >
            {t('exportImport.saveBackupButton')}
          </Button>
        )}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Run the linter**

Run: `pnpm lint`
Expected: PASS — no new warnings.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/screens/SettingsScreen.tsx
git commit -m "feat(settings): \"Backup speichern unter…\" button on Android"
```

---

### Task 6: Manual verification on Android emulator

This is the only place we exercise the real SAF dialog — automated tests cannot cover it.

- [ ] **Step 1: Build and launch on the Android emulator**

Run: `pnpm android` (or use the already-running dev build).
Expected: App launches, no red box.

- [ ] **Step 2: Verify the sheet flow**

In the app:
1. Open any sheet.
2. Open the overflow menu (top-right).
3. Confirm two entries appear: "Bogen teilen…" and "Bogen speichern unter…".
4. Tap "Bogen speichern unter…".
5. The Android SAF folder picker appears. Choose Downloads (or any folder).
6. Confirm the dialog accepts the file. No crash, no error in the Metro logs.
7. In the emulator's Files app, confirm the JSON file is present at the chosen location.

- [ ] **Step 3: Verify the group flow**

Open Group Management → per-row overflow menu → confirm "Gruppe teilen…" and "Gruppe speichern unter…" both present. Run save end-to-end as in Step 2.

- [ ] **Step 4: Verify the settings (backup) flow**

Open Settings → confirm two backup buttons: "Backup teilen" and "Backup speichern unter…". Run save end-to-end as in Step 2.

- [ ] **Step 5: Verify the cancel path**

Trigger "Bogen speichern unter…" again, but cancel the SAF picker. Expected: no error toast, no crash, Metro logs clean.

- [ ] **Step 6: Verify iOS is untouched (if iOS dev environment available)**

If you can run on iOS: open the same three screens and confirm only the original single export entry/button is shown, with the original label.

If no iOS environment is available, document this in the PR description as "iOS verification deferred".

- [ ] **Step 7: Final commit (only if any fixes were needed during manual verification)**

If everything worked: no commit needed.
If a regression was found: fix it, commit with `fix(export): …`, repeat the relevant verification step.

---

## Self-Review Notes

- **Spec coverage:** Tasks 1 (i18n) and 2 (data layer) cover the i18n and architecture sections. Tasks 3–5 cover the three call sites in UX/Architecture. Task 6 covers the Risks section ("SAF dialog cannot be unit-tested").
- **Placeholder scan:** All code blocks contain real, runnable code. No "TODO", no "similar to Task N".
- **Type consistency:** `SaveExportResult` defined in Task 2 is the single source; consumed only via `await saveExportToFile(...)`, return value is discarded (cancel is a no-op, success is implicit). `saveExportToFile` signature matches in all four files that touch it.
- **Out-of-scope check:** No toast/snackbar feedback added (spec excludes). No iOS changes (spec excludes). No persistable URI permissions (spec excludes).
