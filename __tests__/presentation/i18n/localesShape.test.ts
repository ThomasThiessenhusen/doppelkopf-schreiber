import { de } from '@/presentation/i18n/locales/de';
import { en } from '@/presentation/i18n/locales/en';

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    out.push(...flatKeys(v, prefix === '' ? k : `${prefix}.${k}`));
  }
  return out;
}

describe('locales shape', () => {
  test('en hat exakt dieselben Keys wie de', () => {
    const dKeys = flatKeys(de).sort();
    const eKeys = flatKeys(en).sort();
    expect(eKeys).toEqual(dKeys);
  });
});
