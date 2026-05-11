import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function Index() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text variant="headlineMedium">Bockzettel</Text>
      <Text variant="bodyMedium">
        M4-Skelett — Stack-Navigation aktiv. Echte Inhalte folgen ab M6.
      </Text>

      <View style={{ height: 12 }} />

      <Link href="/sheets/new" asChild>
        <Button mode="contained">Neuen Spielbogen anlegen</Button>
      </Link>

      <Link href={{ pathname: '/sheets/[sheetId]', params: { sheetId: 'demo-1' } }} asChild>
        <Button mode="outlined">Demo-Sheet oeffnen (id=demo-1)</Button>
      </Link>

      <Link href="/groups" asChild>
        <Button mode="outlined">Gruppen</Button>
      </Link>

      <Link href="/players" asChild>
        <Button mode="outlined">Spieler</Button>
      </Link>

      <Link href="/settings" asChild>
        <Button mode="outlined">Einstellungen</Button>
      </Link>
    </ScrollView>
  );
}
