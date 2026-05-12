import { suggestFilename } from '@/application/export/filename';

describe('suggestFilename', () => {
  test('basic name + date', () => {
    expect(suggestFilename('Stammtisch', '2026-05-12')).toBe(
      'bockzettel-stammtisch-2026-05-12.json',
    );
  });
  test('umlauts are folded to ascii', () => {
    expect(suggestFilename('Müllers Geburtstag', '2026-05-12')).toBe(
      'bockzettel-muellers-geburtstag-2026-05-12.json',
    );
  });
  test('special chars and runs of dashes are collapsed', () => {
    expect(suggestFilename('  Foo // Bar!?  ', '2026-05-12')).toBe(
      'bockzettel-foo-bar-2026-05-12.json',
    );
  });
  test('empty scope falls back to fallback', () => {
    expect(suggestFilename('', '2026-05-12')).toBe(
      'bockzettel-bogen-2026-05-12.json',
    );
  });
  test('all-special scope falls back', () => {
    expect(suggestFilename('???', '2026-05-12')).toBe(
      'bockzettel-bogen-2026-05-12.json',
    );
  });
});
