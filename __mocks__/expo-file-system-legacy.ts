/**
 * Jest-Mock fuer `expo-file-system/legacy`. Wird in `jest.config.js` ueber
 * `moduleNameMapper` aktiv — App-Runtime nutzt weiterhin die echte
 * expo-file-system. Tests, die gegen echten Storage testen wollen, sollen
 * `createInMemoryStorage` verwenden, nicht diese Stub-Implementierung.
 */
export const documentDirectory = '/tmp/jest-doppelkopf/';

export async function getInfoAsync(_path: string): Promise<{ exists: boolean }> {
  return { exists: false };
}

export async function makeDirectoryAsync(
  _path: string,
  _options?: { intermediates?: boolean },
): Promise<void> {}

export async function readDirectoryAsync(_path: string): Promise<string[]> {
  return [];
}

export async function readAsStringAsync(_path: string): Promise<string> {
  return '{}';
}

export async function writeAsStringAsync(
  _path: string,
  _contents: string,
): Promise<void> {}

export async function moveAsync(_opts: { from: string; to: string }): Promise<void> {}

export async function deleteAsync(
  _path: string,
  _opts?: { idempotent?: boolean },
): Promise<void> {}
