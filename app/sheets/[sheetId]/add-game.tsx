import { useLocalSearchParams } from 'expo-router';

import { AddGameScreen } from '@/presentation/screens/AddGameScreen';

export default function AddGameRoute() {
  const { sheetId, gameId } = useLocalSearchParams<{ sheetId: string; gameId?: string }>();
  return <AddGameScreen sheetId={sheetId} gameId={gameId} />;
}
