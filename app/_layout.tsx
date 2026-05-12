import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { ActivityIndicator, IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { appSettingsFallback } from '@/domain/models/appSettings';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { repositories } from '@/application/stores/repositories';
import { runV2Migration } from '@/data/migrations/v2PoolReference';
import { initI18n } from '@/presentation/i18n';
import { useTranslation } from '@/presentation/i18n/useTranslation';
import { darkTheme, lightTheme } from '@/presentation/theme/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);
  const [i18nReady, setI18nReady] = useState(false);
  const [migrationReady, setMigrationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void runV2Migration(repositories.storage())
      .catch((e) => {
        // Migration ist best-effort; bei Fehler kommt der defensive Fallback in
        // gameSheetFromJson zum Einsatz. UI wird trotzdem freigegeben, damit
        // der Nutzer nicht auf dem Spinner haengen bleibt.
        console.error('v2 migration failed', e);
      })
      .finally(() => {
        if (!cancelled) setMigrationReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!i18nReady || !migrationReady) {
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
      <Stack.Screen
        name="import/review"
        options={{ title: t('exportImport.reviewTitle') }}
      />
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
