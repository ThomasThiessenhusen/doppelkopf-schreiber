import type { LocalStorage } from '@/data/local/localStorage';
import {
  appSettingsFallback,
  appSettingsFromJson,
  appSettingsToJson,
  type AppSettings,
} from '@/domain/models/appSettings';

export interface SettingsRepository {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

/**
 * Persistiert `AppSettings` als einzelne JSON-Datei in der Collection
 * `app_settings` mit fixer ID `current`. Wenn die Datei fehlt oder
 * beschaedigt ist, liefert `load()` den Fallback.
 */
export function createLocalSettingsRepository(storage: LocalStorage): SettingsRepository {
  const COLLECTION = 'app_settings';
  const ID = 'current';

  return {
    async load() {
      const raw = await storage.readOne(COLLECTION, ID);
      if (raw === null) return appSettingsFallback;
      return appSettingsFromJson(raw);
    },
    async save(settings) {
      await storage.write(COLLECTION, ID, appSettingsToJson(settings));
    },
  };
}
