import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { ActivityIndicator, Banner, IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';

import { appSettingsFallback } from '@/domain/models/appSettings';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { repositories } from '@/application/stores/repositories';
import { runV2Migration } from '@/data/migrations/v2PoolReference';
import { requestPersistence } from '@/data/local/requestPersistence';
import { storageNotice } from '@/application/storage/storageNotice';
import { useStorageMode } from '@/presentation/hooks/useStorageMode';
import { initI18n } from '@/presentation/i18n';
import { useTranslation } from '@/presentation/i18n/useTranslation';
import { darkTheme, lightTheme } from '@/presentation/theme/theme';
import type { RootStackParamList } from '@/navigation/types';

import { HomeScreen } from '@/presentation/screens/HomeScreen';
import { NewSheetScreen } from '@/presentation/screens/NewSheetScreen';
import { SheetScreen } from '@/presentation/screens/SheetScreen';
import { AddGameScreen } from '@/presentation/screens/AddGameScreen';
import { GroupManagementScreen } from '@/presentation/screens/GroupManagementScreen';
import { GroupRankingsScreen } from '@/presentation/screens/GroupRankingsScreen';
import { PlayerManagementScreen } from '@/presentation/screens/PlayerManagementScreen';
import { SettingsScreen } from '@/presentation/screens/SettingsScreen';
import { ImportReviewScreen } from '@/presentation/screens/ImportReviewScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function NewSheetRoute({ route }: { route: RouteProp<RootStackParamList, 'NewSheet'> }) {
  return <NewSheetScreen initialGroupId={route.params?.groupId ?? null} />;
}

function SheetRoute({ route }: { route: RouteProp<RootStackParamList, 'Sheet'> }) {
  return <SheetScreen sheetId={route.params.sheetId} />;
}

function AddGameRoute({ route }: { route: RouteProp<RootStackParamList, 'AddGame'> }) {
  return <AddGameScreen sheetId={route.params.sheetId} gameId={route.params.gameId} />;
}

function GroupRankingsRoute({ route }: { route: RouteProp<RootStackParamList, 'GroupRankings'> }) {
  return <GroupRankingsScreen groupId={route.params.groupId} />;
}

function ImportReviewRoute({ route }: { route: RouteProp<RootStackParamList, 'ImportReview'> }) {
  if (typeof route.params.fileUri !== 'string') return null;
  return <ImportReviewScreen fileUri={route.params.fileUri} />;
}

function HomeHeaderRight() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <>
      <IconButton icon="account-group-outline" onPress={() => navigation.navigate('Players')} />
      <IconButton icon="cog-outline" onPress={() => navigation.navigate('Settings')} />
    </>
  );
}

/**
 * Warnt nur dort, wo die Daten wirklich fluechtig sind. IndexedDB und
 * localStorage ueberleben nachweislich einen Neustart und schweigen deshalb;
 * ihre Feinheiten stehen in den Einstellungen.
 */
function StorageWarningBanner() {
  const { t } = useTranslation();
  const mode = useStorageMode();
  // Bedingt gerendert statt ueber `visible={false}`: Paper laesst den Banner
  // sonst gemountet und clippt ihn nur auf Hoehe 0. Im Browser nachgesehen —
  // der `role="alert"` bleibt dann samt Warntext im Accessibility-Baum und
  // wird vorgelesen, obwohl IndexedDB laengst gewonnen hat.
  if (mode === null || storageNotice(mode) !== 'warning') return null;
  return (
    <Banner visible icon="alert-outline">
      {t('storage.memoryWarning')}
    </Banner>
  );
}

function LocalizedStack({ theme }: { theme: typeof lightTheme }) {
  const { t } = useTranslation();
  const screenOptions = {
    headerStyle: { backgroundColor: theme.colors.primaryContainer },
    headerTintColor: theme.colors.onPrimaryContainer,
    headerTitleStyle: { fontWeight: '600' as const },
    contentStyle: { backgroundColor: theme.colors.background },
  };
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('nav.home'), headerRight: HomeHeaderRight }}
      />
      <Stack.Screen
        name="NewSheet"
        component={NewSheetRoute}
        options={{ title: t('nav.newSheet') }}
      />
      <Stack.Screen
        name="Sheet"
        component={SheetRoute}
        options={{ title: t('nav.sheet') }}
      />
      <Stack.Screen
        name="AddGame"
        component={AddGameRoute}
        options={{ title: t('nav.addGame') }}
      />
      <Stack.Screen
        name="Groups"
        component={GroupManagementScreen}
        options={{ title: t('nav.groups') }}
      />
      <Stack.Screen
        name="GroupRankings"
        component={GroupRankingsRoute}
        options={{ title: t('nav.rankings') }}
      />
      <Stack.Screen
        name="Players"
        component={PlayerManagementScreen}
        options={{ title: t('nav.players') }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('nav.settings') }}
      />
      <Stack.Screen
        name="ImportReview"
        component={ImportReviewRoute}
        options={{ title: t('exportImport.reviewTitle') }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
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
    // Bewusst ohne await auf dem Ladepfad: der Browser darf hier nachfragen,
    // und der Startbildschirm soll nicht an einem Dialog haengen. Das
    // Ergebnis ist reine Information, kein Aufrufer haengt daran.
    void requestPersistence();
  }, []);

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
        <StorageWarningBanner />
        <NavigationContainer>
          <LocalizedStack theme={theme} />
        </NavigationContainer>
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
