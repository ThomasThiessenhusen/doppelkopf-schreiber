import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';

import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { useSettingsStore } from '@/application/stores/settingsStore';

export function SettingsScreen() {
  const state = useSettingsStore((s) => s.state);
  const load = useSettingsStore((s) => s.load);
  const setDefaultStackingMode = useSettingsStore((s) => s.setDefaultStackingMode);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text variant="bodyMedium">Fehler beim Laden: {state.error.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text variant="titleMedium">Standard-Bockrunden-Stapelung</Text>
      <Text variant="bodySmall">
        Wird beim Anlegen neuer Spielbogen als Default verwendet. Pro Bogen ueberschreibbar.
      </Text>
      <SegmentedButtons
        value={state.value.defaultStackingMode}
        onValueChange={(v) => {
          void setDefaultStackingMode(v as BockStackingMode);
        }}
        buttons={[
          { value: BockStackingMode.sequential, label: 'Sequenziell' },
          { value: BockStackingMode.doppelbock, label: 'Doppelbock' },
        ]}
      />
    </ScrollView>
  );
}
