import {
  parseExportFile,
  ParseError,
} from '@/application/import/importParser';
import { APP_TAG, FORMAT_VERSION } from '@/application/export/exportTypes';

function validSheetEnvelope() {
  return {
    app: APP_TAG,
    formatVersion: FORMAT_VERSION,
    kind: 'sheet',
    exportedAt: '2026-05-12T15:00:00.000Z',
    exportedFromAppVersion: '0.1.0',
    payload: {
      players: [
        { id: 'a', playerName: 'Anna' },
        { id: 'b', playerName: 'Ben' },
        { id: 'c', playerName: 'Carla' },
        { id: 'd', playerName: 'Dirk' },
      ],
      sheets: [
        {
          id: 'sh-1',
          title: null,
          createdAt: '2026-05-12T14:00:00.000Z',
          updatedAt: '2026-05-12T14:00:00.000Z',
          playerIds: ['a', 'b', 'c', 'd'],
          rounds: [],
          dirty: false,
          stackingModeOverride: null,
          groupId: null,
        },
      ],
      groups: [],
      settings: null,
    },
  };
}

describe('parseExportFile happy paths', () => {
  test('sheet envelope round-trips', () => {
    const raw = JSON.stringify(validSheetEnvelope());
    const parsed = parseExportFile(raw);
    expect(parsed.envelope.kind).toBe('sheet');
    expect(parsed.envelope.payload.sheets[0]!.playerIds).toEqual(['a', 'b', 'c', 'd']);
  });
  test('forward-compatible: unknown payload fields are ignored', () => {
    const e = validSheetEnvelope();
    (e.payload as Record<string, unknown>)['somethingNew'] = 42;
    (e as Record<string, unknown>)['futureMetadata'] = 'hello';
    const parsed = parseExportFile(JSON.stringify(e));
    expect(parsed.envelope.kind).toBe('sheet');
  });
});

describe('parseExportFile errors', () => {
  test('non-JSON throws ParseError with readable message', () => {
    expect(() => parseExportFile('not json {')).toThrow(ParseError);
  });
  test('wrong app field throws', () => {
    const e = validSheetEnvelope();
    (e as Record<string, unknown>)['app'] = 'some_other_app';
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/app/);
  });
  test('wrong formatVersion throws', () => {
    const e = validSheetEnvelope();
    (e as Record<string, unknown>)['formatVersion'] = 99;
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/formatVersion/);
  });
  test('unknown kind throws', () => {
    const e = validSheetEnvelope();
    (e as Record<string, unknown>)['kind'] = 'cake';
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/kind/);
  });
  test('sheet kind with two sheets violates invariant', () => {
    const e = validSheetEnvelope();
    e.payload.sheets.push({ ...e.payload.sheets[0]!, id: 'sh-2' });
    expect(() => parseExportFile(JSON.stringify(e))).toThrow(/sheet/);
  });
});
