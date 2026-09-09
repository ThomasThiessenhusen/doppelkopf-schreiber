import { storageModeKey } from '@/presentation/i18n/storageModeKey';
import { de } from '@/presentation/i18n/locales/de';

describe('storageModeKey', () => {
  test.each([
    ['file', 'storage.modeFile'],
    ['indexeddb', 'storage.modeIndexeddb'],
    ['localstorage', 'storage.modeLocalstorage'],
    ['memory', 'storage.modeMemory'],
  ])('bildet %s auf %s ab', (mode, key) => {
    expect(storageModeKey(mode)).toBe(key);
  });

  test('faellt bei einem unbekannten Modus auf den Unbekannt-Text zurueck', () => {
    expect(storageModeKey('quantenspeicher')).toBe('storage.modeUnknown');
  });

  test('jeder gelieferte Key existiert wirklich im Locale', () => {
    const modi = ['file', 'indexeddb', 'localstorage', 'memory', 'quantenspeicher'];
    for (const mode of modi) {
      const [gruppe, key] = storageModeKey(mode).split('.');
      expect(de[gruppe as 'storage']).toHaveProperty(key as string);
    }
  });
});
