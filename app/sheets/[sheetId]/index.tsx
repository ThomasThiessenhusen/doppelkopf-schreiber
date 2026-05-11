import { useLocalSearchParams } from 'expo-router';

import { SheetScreen } from '@/presentation/screens/SheetScreen';

export default function SheetRoute() {
  const { sheetId } = useLocalSearchParams<{ sheetId: string }>();
  return <SheetScreen sheetId={sheetId} />;
}
