import { requestPersistence } from '@/data/local/requestPersistence.web';

function storageManager(overrides: Partial<StorageManager>): StorageManager {
  return overrides as StorageManager;
}

describe('requestPersistence (web)', () => {
  it('meldet Erfolg, ohne erneut zu fragen, wenn die Origin schon persistent ist', async () => {
    const persist = jest.fn(async () => true);
    const sm = storageManager({ persisted: async () => true, persist });

    await expect(requestPersistence(sm)).resolves.toBe('granted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('fragt an und meldet Erfolg, wenn der Browser zustimmt', async () => {
    const sm = storageManager({ persisted: async () => false, persist: async () => true });

    await expect(requestPersistence(sm)).resolves.toBe('granted');
  });

  it('meldet Ablehnung, wenn der Browser die Anfrage verweigert', async () => {
    const sm = storageManager({ persisted: async () => false, persist: async () => false });

    await expect(requestPersistence(sm)).resolves.toBe('denied');
  });

  it('meldet fehlende Unterstuetzung, wenn es gar keinen StorageManager gibt', async () => {
    await expect(requestPersistence(undefined)).resolves.toBe('unsupported');
  });

  it('meldet fehlende Unterstuetzung, wenn der StorageManager die Methoden nicht hat', async () => {
    await expect(requestPersistence(storageManager({}))).resolves.toBe('unsupported');
  });

  it('meldet fehlende Unterstuetzung, statt einen Wurf durchzureichen', async () => {
    // Unter file:// ist die Origin opak; der Zugriff wirft dort ein
    // SecurityError, statt sauber `false` zu liefern.
    const sm = storageManager({
      persisted: async () => {
        throw new Error('SecurityError');
      },
      persist: async () => true,
    });

    await expect(requestPersistence(sm)).resolves.toBe('unsupported');
  });
});
