/**
 * Tests fuer saveExportToFile mit gemocktem expo-file-system/legacy.
 * Pruefen: cancelled-Pfad schreibt nicht; saved-Pfad ruft SAF korrekt
 * und schreibt die pretty-printed Envelope-JSON.
 */
import * as FileSystem from 'expo-file-system/legacy';

import { saveExportToFile } from '@/data/export/fileShare';
import type { ExportFile } from '@/application/export/exportTypes';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

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
