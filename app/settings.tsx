import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Einstellungen</Text>
      <Text variant="bodyMedium">
        Placeholder — Bock-Stapelmodus-Default folgt in M6.
      </Text>
      <Button mode="outlined" onPress={() => router.back()}>
        Zurueck
      </Button>
    </View>
  );
}
