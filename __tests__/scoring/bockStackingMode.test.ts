import {
  BockStackingMode,
  bockStackingModeFromJson,
  bockStackingModeToJson,
} from '@/domain/scoring/bockStackingMode';

describe('BockStackingMode', () => {
  test.each([BockStackingMode.sequential, BockStackingMode.doppelbock, BockStackingMode.off])(
    'JSON-Roundtrip fuer %s',
    (mode) => {
      expect(bockStackingModeFromJson(bockStackingModeToJson(mode))).toBe(mode);
    },
  );

  test('unbekannter Wert wirft', () => {
    expect(() => bockStackingModeFromJson('quadrupelbock')).toThrow();
  });
});
