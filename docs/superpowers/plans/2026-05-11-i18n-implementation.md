# i18n (DE + EN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App von hartcodiertem Deutsch auf Mehrsprachigkeit (DE + EN) umstellen mit automatischer Erkennung der OS-Sprache und manueller Umstellung in den Settings.

**Architecture:** `i18next` + `react-i18next` in der Presentation-Schicht. Übersetzungen als typisierte TS-Module (`de.ts`, `en.ts`). Sprachpräferenz im bestehenden `AppSettings`-Modell persistiert. Doppelkopf-Fachbegriffe (Re, Kontra, Bock, Solo, Hochzeit, Schwarz, Doppelkopf, Fuchs, Karlchen) bleiben auch in `en.ts` deutsch.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, React Native Paper, Zustand, Jest + Testing-Library, `i18next`, `react-i18next`, `expo-localization`.

**Spec:** [`docs/superpowers/specs/2026-05-11-i18n-design.md`](../specs/2026-05-11-i18n-design.md)

---

## File Structure

### Neue Dateien

- `src/presentation/i18n/index.ts` — i18next-Setup, `i18n`-Instanz, `resolveLanguage()`, `LanguagePreference`-Typ-Export
- `src/presentation/i18n/useTranslation.ts` — getypter Re-Export des Hooks
- `src/presentation/i18n/locales/de.ts` — Default-Sprache, Source of Truth für Key-Struktur
- `src/presentation/i18n/locales/en.ts` — Englische Übersetzungen, typisiert gegen `typeof de`
- `__tests__/presentation/i18n/resolveLanguage.test.ts` — Unit-Tests für `resolveLanguage()`
- `__tests__/presentation/i18n/localesShape.test.ts` — sicherer Shape-Check (`en` ⊆ `de`)

### Geänderte Dateien

- `package.json` — neue Dependencies
- `src/domain/models/appSettings.ts` — Feld `language`, JSON-Serialisierung erweitert
- `__tests__/domain/appSettings.test.ts` — Tests für neues Feld + Backward-Compat
- `src/application/stores/settingsStore.ts` — `setLanguage`-Action
- `app/_layout.tsx` — i18n-Init mit Splash-Warte-Logik, Stack-Titel via `t()`
- `src/presentation/screens/SettingsScreen.tsx` — neue Sprach-Sektion + Strings extrahiert
- `src/presentation/screens/HomeScreen.tsx`
- `src/presentation/screens/NewSheetScreen.tsx`
- `src/presentation/screens/PlayerManagementScreen.tsx`
- `src/presentation/screens/GroupManagementScreen.tsx`
- `src/presentation/screens/GroupRankingsScreen.tsx`
- `src/presentation/screens/SheetScreen.tsx`
- `src/presentation/widgets/Scoreboard.tsx`
- `src/presentation/widgets/RoundSection.tsx`
- `src/presentation/screens/AddGameScreen.tsx`
- `src/presentation/widgets/FlagChip.tsx`
- `src/presentation/widgets/TeamPicker.tsx`
- `src/presentation/screens/addGame/flagSpecs.ts` — Labels → labelKeys
- `src/domain/models/groupType.ts` — falls `groupTypeLabel(...)` deutsche Strings liefert: refactor auf Code → t() in Aufrufer

### Konventionen für alle Tasks

- Paket-Manager: **`pnpm`** (per `package.json`-Konfig).
- Tests laufen mit `pnpm test`. Typecheck: `pnpm typecheck`. Lint: `pnpm lint`.
- Existierende Tests liegen in `__tests__/` und spiegeln `src/`-Struktur. Neue Tests an dieser Konvention orientieren.
- Strings werden **wortgleich** wie heute übernommen (inkl. der „oe/ue/ae"-Schreibweisen). Umlaut-Korrekturen sind ein separater Schritt nach diesem Plan.
- Nach jeder Task: `pnpm typecheck && pnpm test` muss grün sein, bevor commitet wird.

---

## Task 1: Dependencies installieren

**Files:**
- Modify: `package.json` (auto durch Install-Command)
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: i18next + react-i18next installieren**

```bash
pnpm add i18next react-i18next
```

- [ ] **Step 2: expo-localization über Expo-CLI installieren**

`npx expo install` wählt die zu Expo SDK 54 passende Version.

```bash
npx expo install expo-localization
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS (keine neuen Errors)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add i18next, react-i18next, expo-localization"
```

---

## Task 2: `LanguagePreference` und `AppSettings`-Erweiterung (TDD)

**Files:**
- Modify: `src/domain/models/appSettings.ts`
- Modify: `__tests__/domain/appSettings.test.ts`

Backward-Compat: alte gespeicherte Settings ohne `language`-Feld → fallback `'system'`.

- [ ] **Step 1: Failing Test für Default-Language schreiben**

Am Ende von `__tests__/domain/appSettings.test.ts` hinzufügen:

```ts
  test('Default-Sprache ist system', () => {
    expect(appSettingsFallback.language).toBe('system');
  });

  test('JSON-Roundtrip erhaelt language', () => {
    const settings: AppSettings = {
      defaultStackingMode: BockStackingMode.sequential,
      language: 'en',
    };
    const restored = appSettingsFromJson(appSettingsToJson(settings));
    expect(restored.language).toBe('en');
  });

  test('fromJson ohne language-Feld faellt auf system zurueck', () => {
    const settings = appSettingsFromJson({
      defaultStackingMode: 'sequential',
    });
    expect(settings.language).toBe('system');
  });

  test('fromJson mit unbekanntem language-Wert faellt auf system zurueck', () => {
    const settings = appSettingsFromJson({
      defaultStackingMode: 'sequential',
      language: 'klingon',
    });
    expect(settings.language).toBe('system');
  });
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

```bash
pnpm test -- --testPathPattern appSettings
```

Expected: FAIL, `language` ist nicht auf `AppSettings`.

- [ ] **Step 3: `AppSettings` erweitern**

Inhalt von `src/domain/models/appSettings.ts` ersetzen:

```ts
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
```

- [ ] **Step 4: Tests laufen — alle grün**

```bash
pnpm test -- --testPathPattern appSettings
pnpm typecheck
```

Expected: alle PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/models/appSettings.ts __tests__/domain/appSettings.test.ts
git commit -m "feat(settings): add language preference to AppSettings"
```

---

## Task 3: `settingsStore.setLanguage` ergänzen

**Files:**
- Modify: `src/application/stores/settingsStore.ts`

Beachten: Der Store ruft `i18n.changeLanguage` noch **nicht** auf — das macht der Aufrufer im SettingsScreen (vermeidet Zyklus Store → i18n in Task 5/6, wo i18n erst initialisiert wird). Reine Persistenz.

- [ ] **Step 1: `setLanguage` zur Store-Interface ergänzen**

In `src/application/stores/settingsStore.ts`:

Ersetze den Import-Block oben:

```ts
import { create } from 'zustand';

import {
  appSettingsFallback,
  type AppSettings,
  type LanguagePreference,
} from '@/domain/models/appSettings';
import type { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import {
  asyncData,
  asyncError,
  asyncLoading,
  type AsyncState,
} from '@/application/stores/asyncState';
import { repositories } from '@/application/stores/repositories';
```

Ersetze das Interface:

```ts
export interface SettingsStoreState {
  state: AsyncState<AppSettings>;
  load: () => Promise<void>;
  setDefaultStackingMode: (mode: BockStackingMode) => Promise<void>;
  setLanguage: (language: LanguagePreference) => Promise<void>;
}
```

Im `create<…>((set, get) => ({ … }))`-Body, **nach** `setDefaultStackingMode`, neue Action einfügen:

```ts
  async setLanguage(language) {
    const cur = get().state;
    const current = cur.status === 'data' ? cur.value : appSettingsFallback;
    const next: AppSettings = { ...current, language };
    set({ state: asyncData(next) });
    await repositories.settings().save(next);
  },
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/application/stores/settingsStore.ts
git commit -m "feat(settings): add setLanguage action to settingsStore"
```

---

## Task 4: i18n-Modul + Locale-Dateien anlegen (TDD)

**Files:**
- Create: `src/presentation/i18n/locales/de.ts`
- Create: `src/presentation/i18n/locales/en.ts`
- Create: `src/presentation/i18n/index.ts`
- Create: `src/presentation/i18n/useTranslation.ts`
- Create: `__tests__/presentation/i18n/resolveLanguage.test.ts`
- Create: `__tests__/presentation/i18n/localesShape.test.ts`

In dieser Task kommen nur die *gemeinsamen* Keys hinein (alles, was im _layout, Settings, Common gebraucht wird). Pro Screen-Migration in späteren Tasks werden die Locales weiter ergänzt.

- [ ] **Step 1: Locale-Datei `de.ts` anlegen**

`src/presentation/i18n/locales/de.ts`:

```ts
export const de = {
  common: {
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Loeschen',
    close: 'Schliessen',
    retry: 'Erneut versuchen',
    loading: 'Laedt …',
    errorLoading: 'Fehler beim Laden',
  },
  nav: {
    home: 'Bockzettel',
    newSheet: 'Neuer Spielbogen',
    sheet: 'Spielbogen',
    addGame: 'Spiel eintragen',
    groups: 'Gruppen',
    rankings: 'Rangliste',
    players: 'Spieler',
    settings: 'Einstellungen',
  },
  settings: {
    stackingTitle: 'Standard-Bockrunden-Stapelung',
    stackingHint:
      'Wird beim Anlegen neuer Spielbogen als Default verwendet. Pro Bogen ueberschreibbar.',
    stackingSequential: 'Sequenziell',
    stackingDoppelbock: 'Doppelbock',
    languageTitle: 'Sprache',
    languageSystem: 'Systemsprache',
    languageDe: 'Deutsch',
    languageEn: 'Englisch',
  },
} as const;

export type Resources = typeof de;
```

- [ ] **Step 2: Locale-Datei `en.ts` anlegen**

`src/presentation/i18n/locales/en.ts`:

```ts
import type { Resources } from './de';

export const en: Resources = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    close: 'Close',
    retry: 'Retry',
    loading: 'Loading …',
    errorLoading: 'Failed to load',
  },
  nav: {
    home: 'Bockzettel',
    newSheet: 'New sheet',
    sheet: 'Sheet',
    addGame: 'Add game',
    groups: 'Groups',
    rankings: 'Rankings',
    players: 'Players',
    settings: 'Settings',
  },
  settings: {
    stackingTitle: 'Default bock-round stacking',
    stackingHint:
      'Used as default when creating new sheets. Can be overridden per sheet.',
    stackingSequential: 'Sequential',
    stackingDoppelbock: 'Doppelbock',
    languageTitle: 'Language',
    languageSystem: 'System language',
    languageDe: 'German',
    languageEn: 'English',
  },
};
```

- [ ] **Step 3: i18n-Hauptmodul anlegen**

`src/presentation/i18n/index.ts`:

```ts
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
```

- [ ] **Step 4: Typisierten Hook-Re-Export anlegen**

`src/presentation/i18n/useTranslation.ts`:

```ts
export { useTranslation } from 'react-i18next';
```

(Reiner Re-Export — die Typsicherheit kommt aus der Modul-Augmentation in `index.ts`.)

- [ ] **Step 5: Failing Test für `resolveLanguage` schreiben**

`__tests__/presentation/i18n/resolveLanguage.test.ts`:

```ts
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
```

- [ ] **Step 6: Failing Test für Locale-Shape schreiben**

`__tests__/presentation/i18n/localesShape.test.ts`:

```ts
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
```

- [ ] **Step 7: Tests laufen — müssen grün sein (oder: was fehlt, fixen)**

```bash
pnpm test -- --testPathPattern i18n
pnpm typecheck
```

Expected: alle PASS. Falls `localesShape` rot: fehlende Keys in `en.ts` ergänzen.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/i18n __tests__/presentation/i18n
git commit -m "feat(i18n): add i18next setup with de/en locales and resolveLanguage"
```

---

## Task 5: i18n-Init in `app/_layout.tsx`, Stack-Titel umstellen

**Files:**
- Modify: `app/_layout.tsx`

Init-Reihenfolge: SettingsStore laden → i18n initialisieren mit gelesener Preference → erst dann App rendern.

- [ ] **Step 1: `app/_layout.tsx` ersetzen**

Inhalt komplett ersetzen mit:

```tsx
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { ActivityIndicator, IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from '@/presentation/i18n/useTranslation';

import { appSettingsFallback } from '@/domain/models/appSettings';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { initI18n } from '@/presentation/i18n';
import { darkTheme, lightTheme } from '@/presentation/theme/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settingsState.status !== 'data' && settingsState.status !== 'error') return;
    const pref =
      settingsState.status === 'data'
        ? settingsState.value.language
        : appSettingsFallback.language;
    void initI18n(pref).then(() => setI18nReady(true));
  }, [settingsState]);

  if (!i18nReady) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <LocalizedStack theme={theme} />
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

function LocalizedStack({ theme }: { theme: typeof lightTheme }) {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primaryContainer },
        headerTintColor: theme.colors.onPrimaryContainer,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: t('nav.home'), headerRight: HomeHeaderRight }}
      />
      <Stack.Screen name="sheets/new" options={{ title: t('nav.newSheet') }} />
      <Stack.Screen name="sheets/[sheetId]/index" options={{ title: t('nav.sheet') }} />
      <Stack.Screen name="sheets/[sheetId]/add-game" options={{ title: t('nav.addGame') }} />
      <Stack.Screen name="groups/index" options={{ title: t('nav.groups') }} />
      <Stack.Screen name="groups/[groupId]/rankings" options={{ title: t('nav.rankings') }} />
      <Stack.Screen name="players" options={{ title: t('nav.players') }} />
      <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
    </Stack>
  );
}

function HomeHeaderRight() {
  const router = useRouter();
  return (
    <>
      <IconButton icon="account-group-outline" onPress={() => router.push('/players')} />
      <IconButton icon="cog-outline" onPress={() => router.push('/settings')} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck + bestehende Tests**

```bash
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 3: App starten und Smoke-Test**

```bash
pnpm start
```

Im Terminal `w` für Web drücken (am schnellsten). Prüfe:
- App startet, Loading-Spinner verschwindet, Home-Screen erscheint
- Im Header steht "Bockzettel" (bei deutscher OS-Sprache) oder "Bockzettel" (Markenname, identisch in EN)
- Navigation zu anderen Screens — Titel werden korrekt gesetzt

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(i18n): init i18n on app start, localize stack titles"
```

---

## Task 6: SettingsScreen — Strings extrahieren + Sprach-Sektion

**Files:**
- Modify: `src/presentation/screens/SettingsScreen.tsx`

Locale-Keys liegen bereits in `de.ts`/`en.ts` (aus Task 4). Hier nur konsumieren und um die neue Sprach-Sektion erweitern.

- [ ] **Step 1: `SettingsScreen.tsx` ersetzen**

```tsx
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';

import type { LanguagePreference } from '@/domain/models/appSettings';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { applyLanguage } from '@/presentation/i18n';
import { useTranslation } from '@/presentation/i18n/useTranslation';

export function SettingsScreen() {
  const { t } = useTranslation();
  const state = useSettingsStore((s) => s.state);
  const load = useSettingsStore((s) => s.load);
  const setDefaultStackingMode = useSettingsStore((s) => s.setDefaultStackingMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text variant="bodyMedium">
          {t('common.errorLoading')}: {state.error.message}
        </Text>
      </View>
    );
  }

  async function onLanguageChange(next: LanguagePreference) {
    await setLanguage(next);
    await applyLanguage(next);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">{t('settings.stackingTitle')}</Text>
        <Text variant="bodySmall">{t('settings.stackingHint')}</Text>
        <SegmentedButtons
          value={state.value.defaultStackingMode}
          onValueChange={(v) => {
            void setDefaultStackingMode(v as BockStackingMode);
          }}
          buttons={[
            { value: BockStackingMode.sequential, label: t('settings.stackingSequential') },
            { value: BockStackingMode.doppelbock, label: t('settings.stackingDoppelbock') },
          ]}
        />
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">{t('settings.languageTitle')}</Text>
        <SegmentedButtons
          value={state.value.language}
          onValueChange={(v) => {
            void onLanguageChange(v as LanguagePreference);
          }}
          buttons={[
            { value: 'system', label: t('settings.languageSystem') },
            { value: 'de', label: t('settings.languageDe') },
            { value: 'en', label: t('settings.languageEn') },
          ]}
        />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Typecheck + Tests**

```bash
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Manuelles Smoke-Testing**

```bash
pnpm start
```

Web öffnen, zu Settings navigieren. Prüfe:
- Beide Sektionen werden korrekt angezeigt
- Sprach-Umschalter funktioniert: Auswahl "Englisch" → Header und Settings sofort auf Englisch
- Auswahl "Systemsprache" → fällt zurück auf OS-Sprache (im Web meist Browser-Sprache)
- Auswahl persistiert: App neu laden → Sprache bleibt gesetzt

- [ ] **Step 4: Commit**

```bash
git add src/presentation/screens/SettingsScreen.tsx
git commit -m "feat(settings): add language switcher and localize settings screen"
```

---

## Migrations-Pattern für Screens (Tasks 7–12)

Jede der folgenden Screen-Tasks folgt demselben Schema. Bevor du Task 7 beginnst, lies dieses Pattern; in den Tasks selbst wird darauf verwiesen.

**Pattern pro Screen:**

1. **Inventory:** Alle hartcodierten Anzeige-Strings im Screen identifizieren (Buttons, Labels, Titles, Hinweise, Toasts).
2. **Locale ergänzen:** Neue Keys unter passendem Namespace in `de.ts` **und** `en.ts` hinzufügen. Beide Dateien gleichzeitig erweitern, damit `localesShape`-Test grün bleibt.
3. **Hook + Refactor:** `const { t } = useTranslation();` einfügen. Jeden String durch `t('namespace.key')` ersetzen. Bei dynamischen Strings (mit Variablen) Interpolation nutzen: `t('foo.greet', { name })` mit Locale-Wert `'Hallo {{name}}'`.
4. **Domain-Strings:** Wenn der Screen `groupTypeLabel(...)` oder ähnliche Funktionen aus `src/domain` aufruft, die deutsche Strings liefern — siehe Sonderfall unten in Task 10.
5. **Verify:** `pnpm typecheck && pnpm test`. Beide grün.
6. **Smoke-Test im Web:** App starten, Screen besuchen, in beide Sprachen umschalten, prüfen dass kein "Translation missing"-Key sichtbar ist.
7. **Commit** mit Message `feat(i18n): localize <ScreenName>`.

**Interpolations-Konvention:**
Bei zusammengesetzten Strings wie `${count} Spieler · ${games} Spiele` → genau **einen** Key mit Platzhaltern verwenden: `t('home.sheetMeta', { players, games, time })`. Nicht mehrere `t()`-Aufrufe konkatenieren — Wortstellung kann sich zwischen Sprachen unterscheiden.

**Was bleibt deutsch in `en.ts` (Fachbegriffe):**
Re, Kontra, Bock, Solo, Hochzeit, Schwarz, Doppelkopf, Fuchs, Karlchen, Schmeißen — diese Begriffe und ihre direkten Komposita (`Bockrunde`, `Re/Kontra-Ansage`) bleiben in der englischen Version genauso. Übersetzt wird das beschreibende Drumherum: "gefangen" → "caught", "angesagt" → "announced".

---

## Task 7: HomeScreen lokalisieren

**Files:**
- Modify: `src/presentation/screens/HomeScreen.tsx`
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`

- [ ] **Step 1: Keys in `de.ts` ergänzen**

Im Objekt `de` einen neuen Namespace `home` hinzufügen (zwischen `settings` und Ende):

```ts
  home: {
    filterAll: 'Alle Spielboegen',
    filterGroupSummary: '{{name}} ({{type}})',
    rankings: 'Rangliste',
    open: 'Oeffnen',
    deleteMenu: 'Loeschen',
    newSheet: 'Neuer Spielbogen',
    managementGroups: 'Gruppen verwalten',
    deleteTitle: 'Spielbogen loeschen?',
    deleteBody: 'Der Spielbogen „{{title}}“ wird endgueltig geloescht.',
    metaLine: '{{playerCount}} Spieler  ·  {{gameCount}} Spiele  ·  {{time}}',
    defaultTitle: 'Spielbogen {{date}}',
    emptyFiltered: 'Keine Spielbogen in „{{groupName}}“',
    emptyAll: 'Noch keine Spielbogen',
    emptyHintFiltered:
      'Lege einen neuen Spielbogen in dieser Gruppe an oder hebe den Filter auf, um alle Spielbogen zu sehen.',
    emptyHintAll: 'Tippe auf „Neuer Spielbogen“, um den ersten Spielbogen anzulegen.',
    clearFilter: 'Filter aufheben',
  },
```

- [ ] **Step 2: Spiegelbild in `en.ts` ergänzen**

```ts
  home: {
    filterAll: 'All sheets',
    filterGroupSummary: '{{name}} ({{type}})',
    rankings: 'Rankings',
    open: 'Open',
    deleteMenu: 'Delete',
    newSheet: 'New sheet',
    managementGroups: 'Manage groups',
    deleteTitle: 'Delete sheet?',
    deleteBody: 'The sheet “{{title}}” will be permanently deleted.',
    metaLine: '{{playerCount}} players  ·  {{gameCount}} games  ·  {{time}}',
    defaultTitle: 'Sheet {{date}}',
    emptyFiltered: 'No sheets in “{{groupName}}”',
    emptyAll: 'No sheets yet',
    emptyHintFiltered:
      'Create a new sheet in this group, or clear the filter to see all sheets.',
    emptyHintAll: 'Tap “New sheet” to create your first sheet.',
    clearFilter: 'Clear filter',
  },
```

- [ ] **Step 3: HomeScreen.tsx refactoren**

Diese Stellen ändern (Zeilennummern beziehen sich auf den ursprünglichen Stand):

- Zeile 1-22: Imports erweitern um:
  ```ts
  import { useTranslation } from '@/presentation/i18n/useTranslation';
  ```
- Im Komponenten-Body als erste Zeile: `const { t } = useTranslation();`
- Zeile 34-36 `defaultTitle`:
  ```ts
  function defaultTitle(t: (k: string, p?: Record<string, unknown>) => string, sheet: GameSheet): string {
    return t('home.defaultTitle', { date: formatDateTime(sheet.createdAt) });
  }
  ```
  und Aufrufer entsprechend mit `t` aufrufen.
- Zeile 100-103 Filter-Button-Label:
  ```tsx
  {activeGroup === null
    ? t('home.filterAll')
    : t('home.filterGroupSummary', { name: activeGroup.name, type: groupTypeLabel(activeGroup.type) })}
  ```
- Zeile 116: `{t('home.rankings')}`
- Zeile 142-145 metaLine:
  ```ts
  const metaLine = t('home.metaLine', {
    playerCount: sheet.players.length,
    gameCount: totalGamesOf(sheet),
    time: formatDateTime(sheet.updatedAt),
  });
  ```
- Zeile 171 Menu.Item title: `t('home.deleteMenu')`
- Zeile 190: `{t('home.open')}`
- Zeile 201 FAB label: `t('home.newSheet')`
- Zeile 227 List.Item title: `t('home.filterAll')`
- Zeile 247 List.Item title: `t('home.managementGroups')`
- Zeile 257 Dialog.Title: `{t('home.deleteTitle')}`
- Zeile 259-263 Dialog body:
  ```tsx
  <Text variant="bodyMedium">
    {t('home.deleteBody', {
      title: deleteTarget?.title ?? (deleteTarget !== null ? defaultTitle(t, deleteTarget) : ''),
    })}
  </Text>
  ```
- Zeile 266: `{t('common.cancel')}`
- Zeile 268: `{t('common.delete')}`
- `EmptyView` und `ErrorView` umstellen: nutzen `useTranslation()` selbst, ersetzen:
  - Zeile 289-291: `{filtered ? t('home.emptyFiltered', { groupName: activeGroupName }) : t('home.emptyAll')}`
  - Zeile 293-295: `{filtered ? t('home.emptyHintFiltered') : t('home.emptyHintAll')}`
  - Zeile 299: `{t('home.clearFilter')}`
  - Zeile 311: `{t('common.errorLoading')}:`
  - Zeile 317: `{t('common.retry')}`

- [ ] **Step 4: Verify**

```bash
pnpm typecheck
pnpm test
```

Expected: PASS. Falls `localesShape`-Test rot: Keys angleichen.

- [ ] **Step 5: Smoke-Test**

```bash
pnpm start
```

Web öffnen → Home erscheint korrekt, kein "home.xxx"-Roh-Key sichtbar. In Settings auf Englisch umschalten, zurück zu Home — alles englisch.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/screens/HomeScreen.tsx src/presentation/i18n/locales
git commit -m "feat(i18n): localize HomeScreen"
```

---

## Task 8: NewSheetScreen lokalisieren

**Files:**
- Modify: `src/presentation/screens/NewSheetScreen.tsx`
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`

- [ ] **Step 1: Keys in `de.ts` ergänzen**

```ts
  newSheet: {
    titleLabel: 'Titel (optional)',
    titlePlaceholder: 'z. B. Stammtisch Mai',
    groupSection: 'Gruppe',
    groupNone: 'Keine Gruppe',
    groupSummary: '{{name}} ({{type}})',
    playerCountSection: 'Anzahl Spieler',
    playerCount4: '4 Spieler',
    playerCount5: '5 Spieler',
    stackingSection: 'Bockrunden-Stapelung',
    stackingHint: 'Vorausgewaehlt ist der App-Default — fuer diesen Bogen aenderbar.',
    stackingSequential: 'Sequenziell',
    stackingDoppelbock: 'Doppelbock',
    pickPlayers: 'Spieler auswaehlen',
    pickCount: '{{selected}} / {{total}}',
    noPlayersTitle: 'Noch keine Spieler im Pool',
    noPlayersHint: 'Lege zuerst in der Spielerverwaltung Spieler an.',
    openPlayerMgmt: 'Spielerverwaltung oeffnen',
    orderSection: 'Reihenfolge',
    orderHint: 'Position 1 ist der erste Aussetzer/Kartengeber. Mit den Pfeilen umsortieren.',
    firstDealer: 'Erster Aussetzer/Kartengeber',
    create: 'Spielbogen erstellen',
    groupPickerTitle: 'Gruppe waehlen',
    groupOptionNew: 'Neue Gruppe...',
    groupOptionWithType: '{{name}}  ({{type}})',
    groupNewTitle: 'Neue Gruppe',
    groupNewName: 'Name',
    groupTypeSeason: 'Saison',
    groupTypeTournament: 'Turnier',
    groupCreate: 'Anlegen',
  },
```

- [ ] **Step 2: Keys in `en.ts` ergänzen**

```ts
  newSheet: {
    titleLabel: 'Title (optional)',
    titlePlaceholder: 'e.g. Tuesday night',
    groupSection: 'Group',
    groupNone: 'No group',
    groupSummary: '{{name}} ({{type}})',
    playerCountSection: 'Number of players',
    playerCount4: '4 players',
    playerCount5: '5 players',
    stackingSection: 'Bock stacking',
    stackingHint: 'Pre-set to the app default — changeable for this sheet.',
    stackingSequential: 'Sequential',
    stackingDoppelbock: 'Doppelbock',
    pickPlayers: 'Select players',
    pickCount: '{{selected}} / {{total}}',
    noPlayersTitle: 'No players in the pool yet',
    noPlayersHint: 'Add players in the player management first.',
    openPlayerMgmt: 'Open player management',
    orderSection: 'Order',
    orderHint: 'Position 1 is the first sit-out/dealer. Reorder with the arrows.',
    firstDealer: 'First sit-out/dealer',
    create: 'Create sheet',
    groupPickerTitle: 'Choose group',
    groupOptionNew: 'New group...',
    groupOptionWithType: '{{name}}  ({{type}})',
    groupNewTitle: 'New group',
    groupNewName: 'Name',
    groupTypeSeason: 'Season',
    groupTypeTournament: 'Tournament',
    groupCreate: 'Create',
  },
```

- [ ] **Step 3: `NewSheetScreen.tsx` umstellen**

Wende Pattern an. Alle String-Literale durch `t('newSheet.…')` oder `t('common.…')` ersetzen, gemäß den Keys in Step 1. Insbesondere:

- Zeile 166-171 TextInput: `label={t('newSheet.titleLabel')} placeholder={t('newSheet.titlePlaceholder')}`
- Zeile 174: `t('newSheet.groupSection')`
- Zeile 180-182:
  ```tsx
  {selectedGroup === null
    ? t('newSheet.groupNone')
    : t('newSheet.groupSummary', { name: selectedGroup.name, type: groupTypeLabel(selectedGroup.type) })}
  ```
- Zeile 187: `t('newSheet.playerCountSection')`
- Zeile 192-193 buttons: `{ value: '4', label: t('newSheet.playerCount4') }, { value: '5', label: t('newSheet.playerCount5') }`
- Zeile 199-201: `t('newSheet.stackingSection')`, `t('newSheet.stackingHint')`
- Zeile 207-208: `t('newSheet.stackingSequential')`, `t('newSheet.stackingDoppelbock')`
- Zeile 216-220:
  ```tsx
  <Text variant="titleMedium" style={{ flex: 1 }}>
    {t('newSheet.pickPlayers')}
  </Text>
  <Text variant="bodySmall">
    {t('newSheet.pickCount', { selected: selected.length, total: playerCount })}
  </Text>
  ```
- Zeile 230-236: `t('newSheet.noPlayersTitle')`, `t('newSheet.noPlayersHint')`, `t('newSheet.openPlayerMgmt')`
- Zeile 264-266: `t('newSheet.orderSection')`, `t('newSheet.orderHint')`
- Zeile 285: `t('newSheet.firstDealer')`
- Zeile 311: `t('newSheet.create')`
- Zeile 316: `t('newSheet.groupPickerTitle')`
- Zeile 331: label `t('newSheet.groupNone')`
- Zeile 335: `label={t('newSheet.groupOptionWithType', { name: g.name, type: groupTypeLabel(g.type) })}`
- Zeile 339: `t('newSheet.groupOptionNew')`
- Zeile 343: `t('common.close')`
- Zeile 348: `t('newSheet.groupNewTitle')`
- Zeile 352: `label={t('newSheet.groupNewName')}`
- Zeile 362-363: `t('newSheet.groupTypeSeason')`, `t('newSheet.groupTypeTournament')`
- Zeile 369: `t('common.cancel')`
- Zeile 371: `t('newSheet.groupCreate')`

`useTranslation`-Import und Hook-Aufruf an den Anfang.

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm test
```

Expected: PASS.

- [ ] **Step 5: Smoke-Test**

`pnpm start` → Web → "Neuer Spielbogen" öffnen, beide Sprachen testen.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/screens/NewSheetScreen.tsx src/presentation/i18n/locales
git commit -m "feat(i18n): localize NewSheetScreen"
```

---

## Task 9: PlayerManagementScreen lokalisieren

**Files:**
- Modify: `src/presentation/screens/PlayerManagementScreen.tsx`
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`

- [ ] **Step 1: Keys in `de.ts` ergänzen**

```ts
  players: {
    errorFirstNameRequired: 'Vorname ist erforderlich',
    errorLastNameRequired: 'Nachname ist erforderlich',
    addFab: 'Spieler',
    editMenu: 'Bearbeiten',
    deleteMenu: 'Loeschen',
    newTitle: 'Neuer Spieler',
    editTitle: 'Spieler bearbeiten',
    firstNameLabel: 'Vorname',
    lastNameLabel: 'Nachname',
    nicknameLabel: 'Spitzname (optional)',
    createButton: 'Anlegen',
    saveButton: 'Speichern',
    deleteTitle: 'Spieler loeschen?',
    deleteBody: '{{name}} wird aus der Spielerverwaltung entfernt. Bestehende Spielboegen bleiben unveraendert.',
    emptyTitle: 'Noch keine Spieler',
    emptyHint: 'Tippe unten auf „Spieler“, um den ersten Spieler anzulegen.',
  },
```

- [ ] **Step 2: Keys in `en.ts` ergänzen**

```ts
  players: {
    errorFirstNameRequired: 'First name is required',
    errorLastNameRequired: 'Last name is required',
    addFab: 'Player',
    editMenu: 'Edit',
    deleteMenu: 'Delete',
    newTitle: 'New player',
    editTitle: 'Edit player',
    firstNameLabel: 'First name',
    lastNameLabel: 'Last name',
    nicknameLabel: 'Nickname (optional)',
    createButton: 'Create',
    saveButton: 'Save',
    deleteTitle: 'Delete player?',
    deleteBody: '{{name}} will be removed from player management. Existing sheets stay unchanged.',
    emptyTitle: 'No players yet',
    emptyHint: 'Tap “Player” below to add your first player.',
  },
```

- [ ] **Step 3: `PlayerManagementScreen.tsx` refactoren**

Wende Pattern an. Konkret:

- Hook `const { t } = useTranslation();` am Anfang
- Zeile 83-84 Fehlertexte: `t('players.errorFirstNameRequired')`, `t('players.errorLastNameRequired')`
- Zeile 113: `t('common.loading')`
- Zeile 117: `t('common.errorLoading')`
- Zeile 149: `t('players.editMenu')` 
- Zeile 156: `t('players.deleteMenu')`
- Zeile 172: `label={t('players.addFab')}`
- Zeile 179: `editing === null ? t('players.newTitle') : t('players.editTitle')`
- Zeile 183: `label={t('players.firstNameLabel')}`
- Zeile 193: `label={t('players.lastNameLabel')}`
- Zeile 203: `label={t('players.nicknameLabel')}`
- Zeile 211: `t('common.cancel')`
- Zeile 213: `editing === null ? t('players.createButton') : t('players.saveButton')`
- Zeile 219: `t('players.deleteTitle')`
- Zeile 221-223: `t('players.deleteBody', { name: deleteTarget !== null ? playerDisplayName(deleteTarget) : '' })`
- Zeile 227: `t('common.cancel')`
- Zeile 229: `t('common.delete')`
- `EmptyView` braucht eigenen `useTranslation`-Aufruf:
  - Zeile 243: `t('players.emptyTitle')`
  - Zeile 244-245: `t('players.emptyHint')`

- [ ] **Step 4: Verify**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 5: Smoke-Test**

`pnpm start` → Web → Spielerverwaltung öffnen, beide Sprachen.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/screens/PlayerManagementScreen.tsx src/presentation/i18n/locales
git commit -m "feat(i18n): localize PlayerManagementScreen"
```

---

## Task 10: Gruppen — `groupType`-Domain-Strings + Group-Screens lokalisieren

**Files:**
- Read first (Inventory): `src/domain/models/groupType.ts`, `src/presentation/screens/GroupManagementScreen.tsx`, `src/presentation/screens/GroupRankingsScreen.tsx`
- Modify: `src/domain/models/groupType.ts` (Refactor: Label-Funktion durch Code-Mapping ersetzen)
- Modify: `src/presentation/screens/GroupManagementScreen.tsx`
- Modify: `src/presentation/screens/GroupRankingsScreen.tsx`
- Modify: `src/presentation/screens/HomeScreen.tsx` (Aufruf-Stelle anpassen)
- Modify: `src/presentation/screens/NewSheetScreen.tsx` (Aufruf-Stellen anpassen)
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`

`groupTypeLabel(...)` ist die einzige bekannte Stelle, an der eine Domain-Schicht direkt deutschen Anzeige-Text liefert. Per Spec gehört das in die Presentation-Schicht.

- [ ] **Step 1: Aktuelle `groupType.ts` lesen, um Signatur zu verstehen**

```bash
cat src/domain/models/groupType.ts
```

Anzunehmen ist eine Form:
```ts
export enum GroupType { season = 'season', tournament = 'tournament' }
export function groupTypeLabel(t: GroupType): string { /* gibt deutschen Text zurück */ }
```

- [ ] **Step 2: `groupType.ts` umstellen**

`groupTypeLabel` entfernen oder zu **Key-Mapper** umbenennen, der nur den Code → Translation-Key liefert. Beispiel-Refactor (anpassen falls die Datei mehr enthält):

```ts
export enum GroupType {
  season = 'season',
  tournament = 'tournament',
}

/** Translation-Key fuer den Anzeigenamen eines GroupType. */
export function groupTypeLabelKey(t: GroupType): 'groupType.season' | 'groupType.tournament' {
  switch (t) {
    case GroupType.season:
      return 'groupType.season';
    case GroupType.tournament:
      return 'groupType.tournament';
  }
}
```

- [ ] **Step 3: Locale-Keys ergänzen**

In `de.ts`:
```ts
  groupType: {
    season: 'Saison',
    tournament: 'Turnier',
  },
```

In `en.ts`:
```ts
  groupType: {
    season: 'Season',
    tournament: 'Tournament',
  },
```

- [ ] **Step 4: Alle Aufrufer von `groupTypeLabel` anpassen**

Finde Aufrufer:

```bash
git grep -n 'groupTypeLabel' src
```

In jedem Aufrufer (`HomeScreen.tsx`, `NewSheetScreen.tsx`, `GroupManagementScreen.tsx`, evtl. `GroupRankingsScreen.tsx`):

Ersetzen:
```ts
groupTypeLabel(g.type)
```

durch (mit verfügbarem `t`):
```ts
t(groupTypeLabelKey(g.type))
```

Import-Pfad anpassen (`groupTypeLabel` → `groupTypeLabelKey`).

- [ ] **Step 5: GroupManagement- und GroupRankings-Strings extrahieren**

Lies beide Screens:

```bash
cat src/presentation/screens/GroupManagementScreen.tsx
cat src/presentation/screens/GroupRankingsScreen.tsx
```

Inventarisiere alle hartcodierten Strings. Lege die Keys in beiden Locale-Dateien unter `groups: { … }` an. **Beispiel-Schema** — die konkreten Keys ergeben sich aus dem Inventar:

```ts
// de.ts
  groups: {
    addFab: 'Gruppe',
    newTitle: 'Neue Gruppe',
    editTitle: 'Gruppe bearbeiten',
    nameLabel: 'Name',
    typeLabel: 'Typ',
    deleteTitle: 'Gruppe loeschen?',
    deleteBody: 'Die Gruppe {{name}} wird geloescht. Zugewiesene Spielboegen verlieren ihre Gruppenzuordnung.',
    // ... weitere nach Inventar
    rankings: {
      title: 'Rangliste',
      empty: 'Noch keine Spiele in dieser Gruppe.',
      // ... weitere nach Inventar
    },
  },

// en.ts (Spiegelbild)
  groups: {
    addFab: 'Group',
    newTitle: 'New group',
    editTitle: 'Edit group',
    nameLabel: 'Name',
    typeLabel: 'Type',
    deleteTitle: 'Delete group?',
    deleteBody: 'Group {{name}} will be deleted. Assigned sheets will lose their group assignment.',
    rankings: {
      title: 'Rankings',
      empty: 'No games in this group yet.',
    },
  },
```

- [ ] **Step 6: GroupManagement-Screen umstellen — Pattern anwenden**

`useTranslation`-Hook hinzufügen, jeden String durch `t(...)` ersetzen.

- [ ] **Step 7: GroupRankings-Screen umstellen — Pattern anwenden**

Gleich vorgehen.

- [ ] **Step 8: Verify**

```bash
pnpm typecheck && pnpm test
```

Expected: PASS. `localesShape`-Test muss grün sein.

- [ ] **Step 9: Smoke-Test**

`pnpm start` → Web → Gruppen aus dem Home-Header oder Settings öffnen, Anlegen/Bearbeiten/Löschen einmal durchspielen, in beide Sprachen umschalten. Auch Filter im HomeScreen prüfen — die GroupType-Anzeigen müssen jetzt sprachabhängig sein.

- [ ] **Step 10: Commit**

```bash
git add src/domain/models/groupType.ts src/presentation/screens/GroupManagementScreen.tsx src/presentation/screens/GroupRankingsScreen.tsx src/presentation/screens/HomeScreen.tsx src/presentation/screens/NewSheetScreen.tsx src/presentation/i18n/locales
git commit -m "feat(i18n): localize group screens, move groupType labels to presentation"
```

---

## Task 11: Sheet-Ansicht lokalisieren (SheetScreen + Scoreboard + RoundSection)

**Files:**
- Read first: `src/presentation/screens/SheetScreen.tsx`, `src/presentation/widgets/Scoreboard.tsx`, `src/presentation/widgets/RoundSection.tsx`
- Modify: same three files
- Modify: `src/presentation/i18n/locales/de.ts` / `en.ts`

- [ ] **Step 1: Inventory aller deutschen Strings in den drei Dateien**

```bash
cat src/presentation/screens/SheetScreen.tsx src/presentation/widgets/Scoreboard.tsx src/presentation/widgets/RoundSection.tsx
```

Notiere alle Anzeige-Strings (kein Domain-Code, kein Icon-Name). Achte besonders auf:
- Fachbegriffe (Re, Kontra, Bock, …) — bleiben deutsch auch in `en.ts`
- Zusammengesetzte Strings mit Spielständen/Spielernamen — Interpolations-Keys nutzen
- Pluralisierbares ("1 Spiel" vs "5 Spiele") — i18next-Plural-Suffix `_one`/`_other`

- [ ] **Step 2: Keys ergänzen**

Lege Namespace `sheet: { … }` mit allen erfassten Keys in beide Locale-Dateien. Doppelkopf-Fachbegriffe in `en.ts` deutsch lassen, beschreibendes Drumherum übersetzen (z. B. `'Round {{n}}'` für `'Runde {{n}}'`).

- [ ] **Step 3: SheetScreen umstellen (Pattern)**

- [ ] **Step 4: Scoreboard umstellen (Pattern)**

- [ ] **Step 5: RoundSection umstellen (Pattern)**

- [ ] **Step 6: Verify**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 7: Smoke-Test**

`pnpm start` → Web → einen bestehenden Spielbogen öffnen, in beide Sprachen umschalten. Rundenanzeigen und Scoreboard prüfen.

- [ ] **Step 8: Commit**

```bash
git add src/presentation/screens/SheetScreen.tsx src/presentation/widgets/Scoreboard.tsx src/presentation/widgets/RoundSection.tsx src/presentation/i18n/locales
git commit -m "feat(i18n): localize sheet view (SheetScreen, Scoreboard, RoundSection)"
```

---

## Task 12: AddGame-Ansicht lokalisieren — flagSpecs refactor, FlagChip, TeamPicker, AddGameScreen

Die größte Migration: `flagSpecs.ts` mischt Domain-Codes mit UI-Labels — diese Labels müssen heraus und durch i18n-Keys ersetzt werden.

**Files:**
- Read first: alle vier Dateien
- Modify: `src/presentation/screens/addGame/flagSpecs.ts`
- Modify: `src/presentation/screens/AddGameScreen.tsx`
- Modify: `src/presentation/widgets/FlagChip.tsx`
- Modify: `src/presentation/widgets/TeamPicker.tsx`
- Modify: `src/presentation/i18n/locales/de.ts` / `en.ts`

- [ ] **Step 1: `flagSpecs.ts` lesen, Inventar machen**

Aktuell enthält die Datei:
- `StackingCounterSpec.label`: hartcodierter String wie `'Fuchs gefangen'`, `'Doppelkopf'`
- `announcementChipLabel(count)`: liefert `'keine Stufe angesagt'`, `'Unter 90 angesagt +1'`, …
- `levelChipLabel(count)`: liefert `'Stufe'`, `'Unter 90 +1'`, …

- [ ] **Step 2: `flagSpecs.ts` refactoren — Labels raus, Keys rein**

Ersetze `flagSpecs.ts` durch (Code wird komplett gezeigt):

```ts
import {
  contraAnnouncedSchwarz,
  contraAnnouncedUnder30,
  contraAnnouncedUnder60,
  contraAnnouncedUnder90,
  contraDoppelkopf1,
  contraDoppelkopf2,
  contraDoppelkopf3,
  contraDoppelkopf4,
  contraFuchs1,
  contraFuchs2,
  reAnnouncedSchwarz,
  reAnnouncedUnder30,
  reAnnouncedUnder60,
  reAnnouncedUnder90,
  reDoppelkopf1,
  reDoppelkopf2,
  reDoppelkopf3,
  reDoppelkopf4,
  reFuchs1,
  reFuchs2,
  schwarz,
  under30,
  under60,
  under90,
} from '@/domain/scoring/scoringRules';

/** Anzeige-Label-Keys fuer Stacking-Counter (Union — fuer Typsicherheit gegen t()). */
export type StackingCounterLabelKey =
  | 'addGame.flags.fuchsCaught'
  | 'addGame.flags.doppelkopf';

/**
 * Klick-Counter, der durch Stufen 0..N zykliert und mit einem zweiten Counter
 * (Gegenseite) ein Gesamt-Limit teilt.
 */
export interface StackingCounterSpec {
  /** Translation-Key fuer das Anzeige-Label. */
  labelKey: StackingCounterLabelKey;
  /** Codes der Stufen 1..N fuer die Re-Seite (Index 0 = Stufe 1). */
  reCodes: ReadonlyArray<string>;
  /** Codes der Stufen 1..N fuer die Kontra-Seite (Index 0 = Stufe 1). */
  contraCodes: ReadonlyArray<string>;
  /** Maximaler Gesamtcount (Re + Kontra zusammen). */
  maxTotal: number;
}

export function stepsPerSide(spec: StackingCounterSpec): number {
  return spec.reCodes.length;
}

export const fuchsSpec: StackingCounterSpec = {
  labelKey: 'addGame.flags.fuchsCaught',
  reCodes: [reFuchs1.code, reFuchs2.code],
  contraCodes: [contraFuchs1.code, contraFuchs2.code],
  maxTotal: 2,
};

export const doppelkopfSpec: StackingCounterSpec = {
  labelKey: 'addGame.flags.doppelkopf',
  reCodes: [
    reDoppelkopf1.code,
    reDoppelkopf2.code,
    reDoppelkopf3.code,
    reDoppelkopf4.code,
  ],
  contraCodes: [
    contraDoppelkopf1.code,
    contraDoppelkopf2.code,
    contraDoppelkopf3.code,
    contraDoppelkopf4.code,
  ],
  maxTotal: 4,
};

/** Stufe-Kette: Unter 90 → Unter 60 → Unter 30 → Schwarz. */
export const levelCodes: ReadonlyArray<string> = [
  under90.code,
  under60.code,
  under30.code,
  schwarz.code,
];

export const reAnnouncementCodes: ReadonlyArray<string> = [
  reAnnouncedUnder90.code,
  reAnnouncedUnder60.code,
  reAnnouncedUnder30.code,
  reAnnouncedSchwarz.code,
];

export const contraAnnouncementCodes: ReadonlyArray<string> = [
  contraAnnouncedUnder90.code,
  contraAnnouncedUnder60.code,
  contraAnnouncedUnder30.code,
  contraAnnouncedSchwarz.code,
];
```

`announcementChipLabel` und `levelChipLabel` sind in dieser Datei **entfernt** — sie werden im konsumierenden Widget mit `t()` neu aufgebaut.

- [ ] **Step 3: Keys in `de.ts` ergänzen**

```ts
  addGame: {
    flags: {
      fuchsCaught: 'Fuchs gefangen',
      doppelkopf: 'Doppelkopf',
      noLevelAnnounced: 'keine Stufe angesagt',
      levelChipBase: 'Stufe',
      levelUnder90: 'Unter 90 +{{count}}',
      levelUnder60: 'Unter 60 +{{count}}',
      levelUnder30: 'Unter 30 +{{count}}',
      levelSchwarz: 'Schwarz +{{count}}',
      announceUnder90: 'Unter 90 angesagt +{{count}}',
      announceUnder60: 'Unter 60 angesagt +{{count}}',
      announceUnder30: 'Unter 30 angesagt +{{count}}',
      announceSchwarz: 'Schwarz angesagt +{{count}}',
    },
    // weitere AddGame-Keys (Titel, Buttons, Hinweise, TeamPicker-Labels) gemaess Inventar
  },
```

- [ ] **Step 4: Keys in `en.ts` ergänzen**

```ts
  addGame: {
    flags: {
      fuchsCaught: 'Fuchs caught',
      doppelkopf: 'Doppelkopf',
      noLevelAnnounced: 'no level announced',
      levelChipBase: 'Level',
      levelUnder90: 'Unter 90 +{{count}}',
      levelUnder60: 'Unter 60 +{{count}}',
      levelUnder30: 'Unter 30 +{{count}}',
      levelSchwarz: 'Schwarz +{{count}}',
      announceUnder90: 'Unter 90 announced +{{count}}',
      announceUnder60: 'Unter 60 announced +{{count}}',
      announceUnder30: 'Unter 30 announced +{{count}}',
      announceSchwarz: 'Schwarz announced +{{count}}',
    },
    // weitere AddGame-Keys, Spiegelbild zu de.ts
  },
```

- [ ] **Step 5: Im konsumierenden Widget (FlagChip oder AddGameScreen) ChipLabel-Funktionen rekonstruieren**

Identifiziere zunächst, wo `announcementChipLabel`/`levelChipLabel` heute aufgerufen werden:

```bash
git grep -n 'announcementChipLabel\|levelChipLabel' src
```

In der Datei, die sie heute nutzt (vermutlich FlagChip oder AddGameScreen), Hook `useTranslation` holen und Lokal-Funktionen einbauen:

```ts
function buildAnnouncementChipLabel(t: (k: string, p?: Record<string, unknown>) => string, count: number): string {
  if (count <= 0) return t('addGame.flags.noLevelAnnounced');
  if (count === 1) return t('addGame.flags.announceUnder90', { count });
  if (count === 2) return t('addGame.flags.announceUnder60', { count });
  if (count === 3) return t('addGame.flags.announceUnder30', { count });
  return t('addGame.flags.announceSchwarz', { count });
}

function buildLevelChipLabel(t: (k: string, p?: Record<string, unknown>) => string, count: number): string {
  if (count === 1) return t('addGame.flags.levelUnder90', { count });
  if (count === 2) return t('addGame.flags.levelUnder60', { count });
  if (count === 3) return t('addGame.flags.levelUnder30', { count });
  if (count === 4) return t('addGame.flags.levelSchwarz', { count });
  return t('addGame.flags.levelChipBase');
}
```

Aufrufstellen entsprechend anpassen.

- [ ] **Step 6: `StackingCounterSpec.label`-Aufrufer auf `labelKey` umstellen**

Aufrufer finden (präzise, nicht jeden `.label`-Treffer):

```bash
git grep -nE 'fuchsSpec\.label|doppelkopfSpec\.label|StackingCounterSpec' src/presentation
```

In jeder Trefferdatei: `spec.label` durch `t(spec.labelKey)` ersetzen, wo `spec: StackingCounterSpec` ist. Das ergibt direkt sprachabhängige Chip-Labels.

- [ ] **Step 7: FlagChip — restliche Strings extrahieren**

Inventory der hartcodierten Strings in `FlagChip.tsx` machen, Keys ergänzen, ersetzen.

- [ ] **Step 8: TeamPicker — Strings extrahieren**

Inventory in `TeamPicker.tsx`, Keys ergänzen, ersetzen.

- [ ] **Step 9: AddGameScreen — Strings extrahieren**

Inventory in `AddGameScreen.tsx`, Keys ergänzen, ersetzen.

- [ ] **Step 10: Verify**

```bash
pnpm typecheck && pnpm test
```

Expected: PASS. `localesShape`-Test grün.

- [ ] **Step 11: Smoke-Test (gründlich)**

`pnpm start` → Web → "Neuer Spielbogen" anlegen → Spieler auswählen → "Spiel eintragen" öffnen. Alle Flags durchklicken: Fuchs gefangen, Doppelkopf, Stufenansage, Stufen. Einmal mit DE, einmal mit EN. Prüfen:
- Keine "translation missing"-Keys sichtbar
- Counts werden korrekt interpoliert ("+1", "+2", …)
- "Re"/"Kontra"-Labels bleiben in beiden Sprachen "Re"/"Kontra"
- Speichern eines Spiels funktioniert weiterhin

- [ ] **Step 12: Commit**

```bash
git add src/presentation/screens/addGame/flagSpecs.ts src/presentation/screens/AddGameScreen.tsx src/presentation/widgets/FlagChip.tsx src/presentation/widgets/TeamPicker.tsx src/presentation/i18n/locales
git commit -m "feat(i18n): localize AddGame view, move flag labels to translation keys"
```

---

## Task 13: Abschlussprüfung — Restliche deutsche Strings finden

**Files:**
- Audit only — keine geplanten Änderungen, aber bei Funden: Mini-Commits.

- [ ] **Step 1: Audit nach übrig gebliebenen deutschen Strings**

```bash
git grep -nE "'[^']*[A-Za-z]ae[a-z]|oe[a-z]|ue[a-z]|[Ää]|[Öö]|[Üü]|ß" src/presentation src/application app
```

Manuell durchgehen. Erwartet: nur Strings in `src/presentation/i18n/locales/de.ts`. Alles andere ist ein Fund.

- [ ] **Step 2: Audit nach hartcodierten Anzeige-Strings**

```bash
git grep -nE '">[A-ZÄÖÜ][a-zäöüß][^<]*<' src/presentation src/application app
```

Identifiziert JSX-Inline-Text. Erwartet leer (außer false positives).

- [ ] **Step 3: Falls Funde — Pattern anwenden**

Pro Fund: Key in `de.ts` + `en.ts`, durch `t(...)` ersetzen, einzeln committen.

- [ ] **Step 4: Final-Verify**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Alle drei grün.

- [ ] **Step 5: Final-Smoke-Test**

`pnpm start` → Web → komplette Hauptflows einmal in DE, einmal in EN:
1. Home öffnen
2. Neuer Spielbogen anlegen (mit Gruppe + Stapelmodus + 4 Spielern)
3. Spiel eintragen mit Bockflag und Stufenansage
4. Zurück zur Sheet-Übersicht, Spiel sichtbar
5. Gruppen-Rankings öffnen
6. Spieler-Management öffnen, Spieler bearbeiten
7. Sprache wechseln, alle Screens noch einmal kurz prüfen

- [ ] **Step 6: Audit-Commit (falls Funde gemacht)**

Nur wenn in Schritten 1–3 etwas geändert wurde:

```bash
git add -A
git commit -m "feat(i18n): cover remaining hardcoded strings found in audit"
```

---

## Definition of Done

- [ ] `pnpm typecheck` grün
- [ ] `pnpm test` grün (inkl. `resolveLanguage`, `localesShape`, `appSettings`)
- [ ] `pnpm lint` grün
- [ ] Audit aus Task 13 zeigt keine ungewollten deutschen Strings außerhalb von `de.ts` / `en.ts` / Fachbegriff-Whitelist
- [ ] Sprachumschalter im SettingsScreen funktioniert sofort ohne App-Neustart
- [ ] Sprachpräferenz überlebt App-Neustart (Repository-Roundtrip)
- [ ] Beim ersten Start auf nicht-deutscher OS-Sprache erscheint die App auf Englisch
- [ ] Doppelkopf-Fachbegriffe (Re, Kontra, Bock, Solo, Hochzeit, Schwarz, Doppelkopf, Fuchs, Karlchen) erscheinen im EN-Modus weiterhin deutsch
- [ ] Spec [`docs/superpowers/specs/2026-05-11-i18n-design.md`](../specs/2026-05-11-i18n-design.md) ist vollständig umgesetzt
