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
