import * as FileSystem from 'expo-file-system/legacy';

/**
 * Native Variante: liest eine Textdatei ueber den vom DocumentPicker
 * gelieferten `file://`- bzw. `content://`-URI.
 *
 * Das Gegenstueck ist `readTextFile.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export function readTextFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}
