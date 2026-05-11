import {
  BockStackingMode,
  bockStackingModeToJson,
} from '@/domain/scoring/bockStackingMode';

/** App-weite Einstellungen, persistiert in einer JSON-Datei. */
export interface AppSettings {
  readonly defaultStackingMode: BockStackingMode;
}

/** Default fuer Erst-Installationen oder beschaedigte Settings-Datei. */
export const appSettingsFallback: AppSettings = {
  defaultStackingMode: BockStackingMode.sequential,
};

export function appSettingsToJson(settings: AppSettings): Record<string, unknown> {
  return {
    defaultStackingMode: bockStackingModeToJson(settings.defaultStackingMode),
  };
}

/**
 * Liest AppSettings aus einer JSON-Map. Unbekannte oder fehlende
 * `defaultStackingMode`-Werte fallen auf den Fallback zurueck.
 */
export function appSettingsFromJson(json: Record<string, unknown>): AppSettings {
  const raw = json['defaultStackingMode'];
  if (raw !== 'sequential' && raw !== 'doppelbock') {
    return appSettingsFallback;
  }
  return { defaultStackingMode: raw };
}
