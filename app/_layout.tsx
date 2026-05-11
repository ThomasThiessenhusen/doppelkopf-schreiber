import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { IconButton, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { darkTheme, lightTheme } from '@/presentation/theme/theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
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
            options={{ title: 'Bockzettel', headerRight: HomeHeaderRight }}
          />
          <Stack.Screen name="sheets/new" options={{ title: 'Neuer Spielbogen' }} />
          <Stack.Screen name="sheets/[sheetId]/index" options={{ title: 'Spielbogen' }} />
          <Stack.Screen name="sheets/[sheetId]/add-game" options={{ title: 'Spiel eintragen' }} />
          <Stack.Screen name="groups/index" options={{ title: 'Gruppen' }} />
          <Stack.Screen name="groups/[groupId]/rankings" options={{ title: 'Rangliste' }} />
          <Stack.Screen name="players" options={{ title: 'Spieler' }} />
          <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
        </Stack>
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
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
