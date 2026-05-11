import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

export default function GroupsScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Gruppen</Text>
      <Text variant="bodyMedium">
        Placeholder — Saison-/Turnier-Listen folgen in M6.
      </Text>
      <Button
        mode="contained"
        onPress={() =>
          router.push({ pathname: '/groups/[groupId]/rankings', params: { groupId: 'demo' } })
        }
      >
        Demo-Rangliste oeffnen (id=demo)
      </Button>
    </View>
  );
}
