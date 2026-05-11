import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function AddGameScreen() {
  const { sheetId } = useLocalSearchParams<{ sheetId: string }>();
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Spiel eintragen</Text>
      <Text variant="bodyMedium">Sheet-ID: {sheetId}</Text>
      <Text variant="bodyMedium">
        Placeholder — Team-Picker und Flag-Picker folgen in M6.
      </Text>
      <Button mode="outlined" onPress={() => router.back()}>
        Zurueck
      </Button>
    </View>
  );
}
