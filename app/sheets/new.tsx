import { useLocalSearchParams } from 'expo-router';

import { NewSheetScreen } from '@/presentation/screens/NewSheetScreen';

export default function NewSheetRoute() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  return <NewSheetScreen initialGroupId={groupId ?? null} />;
}
