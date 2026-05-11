import { useLocalSearchParams } from 'expo-router';

import { GroupRankingsScreen } from '@/presentation/screens/GroupRankingsScreen';

export default function GroupRankingsRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <GroupRankingsScreen groupId={groupId} />;
}
