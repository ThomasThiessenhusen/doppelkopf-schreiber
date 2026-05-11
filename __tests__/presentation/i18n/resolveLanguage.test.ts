import { resolveLanguage } from '@/presentation/i18n';

describe('resolveLanguage', () => {
  test("'de' Preference -> 'de'", () => {
    expect(resolveLanguage('de', 'en')).toBe('de');
  });

  test("'en' Preference -> 'en'", () => {
    expect(resolveLanguage('en', 'de')).toBe('en');
  });

  test("'system' + OS=de -> 'de'", () => {
    expect(resolveLanguage('system', 'de')).toBe('de');
  });

  test("'system' + OS=en -> 'en'", () => {
    expect(resolveLanguage('system', 'en')).toBe('en');
  });

  test("'system' + OS=fr -> 'en' (Fallback)", () => {
    expect(resolveLanguage('system', 'fr')).toBe('en');
  });

  test("'system' + OS=null -> 'en' (Fallback)", () => {
    expect(resolveLanguage('system', null)).toBe('en');
  });
});
