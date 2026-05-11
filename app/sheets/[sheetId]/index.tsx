import { Link, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function SheetScreen() {
  const { sheetId } = useLocalSearchParams<{ sheetId: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Spielbogen</Text>
      <Text variant="bodyMedium">ID: {sheetId}</Text>
      <Text variant="bodyMedium">
        Placeholder — Scoreboard und Runden-Liste folgen in M6.
      </Text>
      <Link href={{ pathname: '/sheets/[sheetId]/add-game', params: { sheetId } }} asChild>
        <Button mode="contained">Spiel eintragen</Button>
      </Link>
    </View>
  );
}
