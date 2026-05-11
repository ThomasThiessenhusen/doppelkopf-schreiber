import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function PlayersScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Spielerverwaltung</Text>
      <Text variant="bodyMedium">
        Placeholder — Spielerpool (CRUD) folgt in M6.
      </Text>
      <Button mode="outlined" onPress={() => router.back()}>
        Zurueck
      </Button>
    </View>
  );
}
