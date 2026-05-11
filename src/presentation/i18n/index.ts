import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import type { LanguagePreference } from '@/domain/models/appSettings';

import { de, type Resources } from './locales/de';
import { en } from './locales/en';

export type { LanguagePreference } from '@/domain/models/appSettings';

/** Welche konkrete Sprache aus einer Preference + OS-Sprache resultiert. */
export function resolveLanguage(
  pref: LanguagePreference,
  osLanguageCode: string | null,
): 'de' | 'en' {
  if (pref === 'de' || pref === 'en') return pref;
  return osLanguageCode === 'de' ? 'de' : 'en';
}

/** Liest die erste Locale-Sprache vom OS (oder null). */
function osLanguageCode(): string | null {
  const code = getLocales()[0]?.languageCode ?? null;
  return code;
}

let initialized = false;

/** Initialisiert i18next einmalig. Idempotent. */
export async function initI18n(pref: LanguagePreference): Promise<void> {
  if (initialized) {
    await i18n.changeLanguage(resolveLanguage(pref, osLanguageCode()));
    return;
  }
  await i18n.use(initReactI18next).init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    lng: resolveLanguage(pref, osLanguageCode()),
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialized = true;
}

/** Zur Laufzeit umschalten (z. B. aus dem Settings-Screen). */
export async function applyLanguage(pref: LanguagePreference): Promise<void> {
  await i18n.changeLanguage(resolveLanguage(pref, osLanguageCode()));
}

export { i18n };

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Resources };
  }
}
