import type { ExportFile } from '@/application/export/exportTypes';
import type { SaveExportResult } from '@/data/export/fileShare';

export type { SaveExportResult };

/**
 * Web-Variante: der Browser kennt kein Share-Sheet fuer Dateien, also wird
 * der Envelope als Blob heruntergeladen. Wohin er landet, entscheidet die
 * Download-Einstellung des Browsers.
 *
 * Das Gegenstueck ist `fileShare.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export async function shareExport(
  file: ExportFile,
  doc: Document = globalThis.document,
): Promise<void> {
  const json = JSON.stringify(file.envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = file.suggestedFilename;
    anchor.style.display = 'none';
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Der Download startet asynchron. Ein sofortiges revoke kann ihm die
    // Quelle entziehen, darum erst einen Tick spaeter freigeben.
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Im Browser gibt es kein Gegenstueck zum Storage Access Framework — die
 * Oberflaeche blendet diesen Knopf ohnehin nur unter Android ein
 * (`Platform.OS === 'android'`), also ist dieser Wurf reine Absicherung
 * gegen einen Aufruf, den es nicht geben sollte.
 */
export function saveExportToFile(_file: ExportFile): Promise<SaveExportResult> {
  return Promise.reject(
    new Error('Speichern unter... ist im Browser nicht verfuegbar; benutze den Export.'),
  );
}
