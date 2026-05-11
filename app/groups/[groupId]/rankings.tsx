import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function GroupRankingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Rangliste</Text>
      <Text variant="bodyMedium">Group-ID: {groupId}</Text>
      <Text variant="bodyMedium">
        Placeholder — Drei Ranglisten (Platzierungspunkte, Spielpunkte, Soli) folgen in M6.
      </Text>
      <Button mode="outlined" onPress={() => router.back()}>
        Zurueck
      </Button>
    </View>
  );
}
