import { parseScanText } from '@/application/import/scanParser';
import { buildScanPrompt } from '@/application/import/scanPrompt';

describe('buildScanPrompt', () => {
  test.each(['de', 'en'] as const)('%s enthaelt Schema-Schluessel und null-Regel', (lang) => {
    const p = buildScanPrompt(lang);
    expect(p).toContain('"kind": "scan"');
    expect(p).toContain('"points"');
    expect(p).toContain('"uncertain"');
    expect(p).toContain('"totals"');
    expect(p).toContain('null');
  });

  test('beide Sprachen verwenden dieselben Schluesselnamen', () => {
    const keys = ['app', 'kind', 'formatVersion', 'title', 'playedAt', 'players', 'games'];
    for (const k of keys) {
      expect(buildScanPrompt('de')).toContain(`"${k}"`);
      expect(buildScanPrompt('en')).toContain(`"${k}"`);
    }
  });

  test.each(['de', 'en'] as const)('%s: Beispiel-JSON im Prompt ist parsebar', (lang) => {
    const s = parseScanText(buildScanPrompt(lang));
    expect(s.players).toHaveLength(4);
    expect(s.games.length).toBeGreaterThan(0);
    for (const row of s.games) {
      expect(row.reduce<number>((a, b) => a + (b ?? 0), 0)).toBe(0);
    }
  });

  test.each(['de', 'en'] as const)('%s erklaert die Zwischenstaende', (lang) => {
    const p = buildScanPrompt(lang);
    expect(p).toContain('"cumulative"');
    expect(p).toMatch(/Zwischenstand|running total/);
  });

  test('de erwaehnt, dass die Bock-Markierung ignoriert wird', () => {
    expect(buildScanPrompt('de')).toMatch(/Bock/);
    expect(buildScanPrompt('en')).toMatch(/Bock/i);
  });
});
