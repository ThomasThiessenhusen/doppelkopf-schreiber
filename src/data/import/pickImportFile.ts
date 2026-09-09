import * as DocumentPicker from 'expo-document-picker';

/**
 * Ergebnis der Dateiauswahl. `cancelled` ist ein normaler Ausgang, kein
 * Fehler — der Aufrufer tut dann schlicht nichts.
 */
export type PickedFile = { status: 'picked'; uri: string } | { status: 'cancelled' };

/**
 * Native Variante: System-Dateidialog ueber `expo-document-picker`.
 *
 * Das Gegenstueck ist `pickImportFile.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export async function pickImportFile(): Promise<PickedFile> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled === true) return { status: 'cancelled' };

  const uri = res.assets?.[0]?.uri;
  if (typeof uri !== 'string') return { status: 'cancelled' };

  return { status: 'picked', uri };
}
