import { storageNotice } from '@/application/storage/storageNotice';

describe('storageNotice', () => {
  it('schweigt beim Dateisystem der nativen App', () => {
    expect(storageNotice('file')).toBe('none');
  });

  it('schweigt bei IndexedDB', () => {
    expect(storageNotice('indexeddb')).toBe('none');
  });

  it('informiert leise ueber den begrenzten localStorage', () => {
    expect(storageNotice('localstorage')).toBe('info');
  });

  it('warnt, wenn nur der Arbeitsspeicher uebrig bleibt', () => {
    expect(storageNotice('memory')).toBe('warning');
  });

  it('behandelt einen unbekannten Modus als erklaerungsbeduerftig', () => {
    expect(storageNotice('quantenspeicher')).toBe('info');
  });
});
