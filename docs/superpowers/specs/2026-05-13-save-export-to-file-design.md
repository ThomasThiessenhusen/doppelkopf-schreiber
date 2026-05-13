# Save export to file (Android Storage Access Framework)

## Context

Spec 2a (export / import) shipped with a single export path: the user
taps "Bogen/Gruppe/Backup exportieren…" and the app calls
`shareExport`, which writes the JSON to the app cache and opens the
system share sheet. On iOS, the share sheet exposes "In Dateien
sichern" so users can already pick an arbitrary location. On Android,
the share-sheet experience is OEM-dependent: the "Save to Files" entry
is missing on many devices or buried behind several taps, so users
cannot reliably get the file onto local storage.

## Goal

On Android, a user can write an export directly to a self-chosen
location on the device through the Storage Access Framework (SAF)
folder picker, as a second action alongside the existing share flow.
iOS behaviour is unchanged.

## Out of scope

- iOS UI / behaviour. The existing share-sheet flow already covers
  "save to Files" on iOS, and we do not want to introduce a custom
  native module for `UIDocumentPickerViewController`.
- Persistable URI permissions / "remember last directory". Each
  "Speichern unter…" invocation asks the user where to save.
- Toast / snackbar success or failure feedback. Today's export flow
  only logs to the console on failure; adding UI feedback is its own
  task that should cover share, save, and import together.
- Web platform. Export is already share-only on web.

## UX

Three call sites already trigger an export today:

- `SheetScreen` overflow menu — "Bogen exportieren…"
- `GroupManagementScreen` per-row menu — "Gruppe exportieren…"
- `SettingsScreen` — "Backup exportieren" button

After this change:

| Platform | "Share" entry | "Save to file" entry |
|----------|---------------|----------------------|
| iOS | Unchanged label ("Bogen/Gruppe/Backup exportieren…"), unchanged behaviour | Not shown |
| Android | Relabelled to "… teilen…" / "Backup teilen", same code path | New entry/button "… speichern unter…" / "Backup speichern unter…", triggers SAF picker |

The "Share" entry's underlying code path (`shareExport`) is identical
on both platforms — only its German label differs by platform so that
the two Android entries read clearly side-by-side.

## Architecture

### Data layer

Add a new function to [`src/data/export/fileShare.ts`](src/data/export/fileShare.ts):

```ts
export type SaveExportResult =
  | { status: 'saved'; uri: string }
  | { status: 'cancelled' };

export async function saveExportToFile(
  file: ExportFile,
): Promise<SaveExportResult>;
```

Implementation:

1. Guard with `Platform.OS === 'android'` — throw a clear error on
   non-Android platforms. The UI will never call it on iOS.
2. `FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()`.
   If `granted === false`, return `{ status: 'cancelled' }`.
3. `FileSystem.StorageAccessFramework.createFileAsync(directoryUri,
   file.suggestedFilename, 'application/json')` to get the new file's
   content URI.
4. `FileSystem.writeAsStringAsync(newUri, JSON.stringify(file.envelope,
   null, 2))`.
5. Return `{ status: 'saved', uri: newUri }`.

`shareExport` stays as it is — no rename, no behavioural change.

### Presentation layer

In each of the three screens, add a second menu item / button rendered
only when `Platform.OS === 'android'`. The new control calls
`saveExportToFile` with the same `ExportFile` produced by
`exportSheet` / `exportGroup` / `exportBackup`.

Error handling mirrors the existing share flow:

```ts
try {
  const file = await exportSheet(sheet.id);
  const result = await saveExportToFile(file);
  // result.status === 'cancelled' is a no-op
} catch (e) {
  console.error(t('exportImport.exportFailed'), e);
}
```

The existing share-action callbacks are not touched; only the label
they render changes on Android.

### i18n

In `src/presentation/i18n/locales/de.ts` and `…/en.ts`:

- Keep `exportSheetMenu`, `exportGroupMenu`, `exportBackupButton` —
  these are now the iOS labels.
- Add three new "share on Android" labels:
  `shareSheetMenu`, `shareGroupMenu`, `shareBackupButton`
  (DE: "Bogen teilen…" / "Gruppe teilen…" / "Backup teilen";
  EN: "Share sheet…" / "Share group…" / "Share backup").
- Add three new "save on Android" labels:
  `saveSheetMenu`, `saveGroupMenu`, `saveBackupButton`
  (DE: "Bogen speichern unter…" / "Gruppe speichern unter…" /
  "Backup speichern unter…";
  EN: "Save sheet…" / "Save group…" / "Save backup…").

UI picks per-platform:

```ts
const shareLabel = Platform.OS === 'android'
  ? t('exportImport.shareSheetMenu')
  : t('exportImport.exportSheetMenu');
```

This keeps the i18n files free of platform branching and concentrates
the platform logic in the screens.

## Testing

- New unit test `__tests__/data/fileShare.test.ts` (or extend if one
  exists). Mock `expo-file-system`'s `StorageAccessFramework` module
  and assert:
  - cancelled-permission path returns `{ status: 'cancelled' }` and
    does not call `writeAsStringAsync`;
  - granted path calls `createFileAsync` with the expected filename
    and MIME type, then `writeAsStringAsync` with the pretty-printed
    envelope JSON, and returns `{ status: 'saved', uri }`.
- No new tests for the UI screens — the change is mechanical wiring
  identical to the existing share entries.

## Risks and notes

- `expo-file-system@19.0.22` exposes SAF through the legacy entry
  (`expo-file-system/legacy`), which the code already imports — no
  new dependency.
- SAF write quotas / permission denials surface as thrown errors and
  hit the existing `console.error` path; that is acceptable for v1.
- The user can rename the file in the system picker; we pass
  `suggestedFilename` as the default but do not depend on it being
  honoured.
