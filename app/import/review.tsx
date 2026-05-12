import { useLocalSearchParams } from 'expo-router';

import { ImportReviewScreen } from '@/presentation/screens/ImportReviewScreen';

export default function ImportReviewRoute() {
  const { fileUri } = useLocalSearchParams<{ fileUri: string }>();
  if (typeof fileUri !== 'string') {
    return null;
  }
  return <ImportReviewScreen fileUri={fileUri} />;
}
