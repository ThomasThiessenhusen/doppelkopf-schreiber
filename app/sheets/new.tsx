import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function NewSheetScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Neuer Spielbogen</Text>
      <Text variant="bodyMedium">
        Placeholder — echte Spielerauswahl + Erstellung folgen in M6.
      </Text>
      <Button mode="outlined" onPress={() => router.back()}>
        Zurueck
      </Button>
    </View>
  );
}
