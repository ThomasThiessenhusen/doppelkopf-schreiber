import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { renderSheetHtml } from '@/application/export/sheetHtml';

/**
 * Native Variante: HTML -> PDF-Datei -> System-Share-Sheet.
 *
 * Das Gegenstueck ist `pdfShare.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export async function sharePdf(sheetId: string): Promise<void> {
  const { html, filename } = await renderSheetHtml(sheetId);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const cacheDir = `${FileSystem.cacheDirectory ?? ''}exports/`;
  const info = await FileSystem.getInfoAsync(cacheDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
  const destUri = `${cacheDir}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error('Sharing ist auf diesem Gerät nicht verfügbar.');
  await Sharing.shareAsync(destUri, { mimeType: 'application/pdf', dialogTitle: 'PDF teilen' });
}
