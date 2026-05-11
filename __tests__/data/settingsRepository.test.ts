import { createInMemoryStorage } from './_inMemoryStorage';
import { createLocalSettingsRepository } from '@/data/repositories/settingsRepository';
import { appSettingsFallback, type AppSettings } from '@/domain/models/appSettings';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';

describe('LocalSettingsRepository', () => {
  test('load ohne Datei liefert appSettingsFallback', async () => {
    const repo = createLocalSettingsRepository(createInMemoryStorage());
    const s = await repo.load();
    expect(s.defaultStackingMode).toBe(appSettingsFallback.defaultStackingMode);
  });

  test('save + load Roundtrip', async () => {
    const repo = createLocalSettingsRepository(createInMemoryStorage());
    const original: AppSettings = {
      defaultStackingMode: BockStackingMode.doppelbock,
      language: 'system',
    };
    await repo.save(original);
    const restored = await repo.load();
    expect(restored.defaultStackingMode).toBe(BockStackingMode.doppelbock);
  });
});
