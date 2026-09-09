/**
 * Uebersetzungs-Key, der den Speichermodus fuer Menschen beschreibt.
 *
 * Die Keys stehen hier ausgeschrieben statt zusammengebaut, weil
 * `CustomTypeOptions` sie typpruefen kann — ein Template-String wie
 * `storage.mode${...}` waere fuer i18next nur noch `string`.
 */
export type StorageModeKey =
  | 'storage.modeFile'
  | 'storage.modeIndexeddb'
  | 'storage.modeLocalstorage'
  | 'storage.modeMemory'
  | 'storage.modeUnknown';

export function storageModeKey(mode: string): StorageModeKey {
  switch (mode) {
    case 'file':
      return 'storage.modeFile';
    case 'indexeddb':
      return 'storage.modeIndexeddb';
    case 'localstorage':
      return 'storage.modeLocalstorage';
    case 'memory':
      return 'storage.modeMemory';
    default:
      return 'storage.modeUnknown';
  }
}
