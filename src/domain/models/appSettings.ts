import {
  BockStackingMode,
  bockStackingModeToJson,
} from '@/domain/scoring/bockStackingMode';

/** Sprachpräferenz: 'system' folgt OS-Sprache; 'de'/'en' überschreiben manuell. */
export type LanguagePreference = 'system' | 'de' | 'en';

const LANGUAGE_VALUES: ReadonlyArray<LanguagePreference> = ['system', 'de', 'en'];

function parseLanguage(raw: unknown): LanguagePreference {
  return typeof raw === 'string' && (LANGUAGE_VALUES as ReadonlyArray<string>).includes(raw)
    ? (raw as LanguagePreference)
    : 'system';
}

/** App-weite Einstellungen, persistiert in einer JSON-Datei. */
export interface AppSettings {
  readonly defaultStackingMode: BockStackingMode;
  readonly language: LanguagePreference;
}

/** Default fuer Erst-Installationen oder beschaedigte Settings-Datei. */
export const appSettingsFallback: AppSettings = {
  defaultStackingMode: BockStackingMode.sequential,
  language: 'system',
};

export function appSettingsToJson(settings: AppSettings): Record<string, unknown> {
  return {
    defaultStackingMode: bockStackingModeToJson(settings.defaultStackingMode),
    language: settings.language,
  };
}

/**
 * Liest AppSettings aus einer JSON-Map. Unbekannte oder fehlende Felder
 * fallen auf den Fallback zurueck.
 */
export function appSettingsFromJson(json: Record<string, unknown>): AppSettings {
  const rawMode = json['defaultStackingMode'];
  const defaultStackingMode: BockStackingMode =
    rawMode === 'sequential' || rawMode === 'doppelbock'
      ? rawMode
      : appSettingsFallback.defaultStackingMode;
  const language = parseLanguage(json['language']);
  return { defaultStackingMode, language };
}
