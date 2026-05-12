import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, SegmentedButtons, Text } from 'react-native-paper';

import { exportBackup } from '@/application/export/exportService';
import { shareExport } from '@/data/export/fileShare';
import type { LanguagePreference } from '@/domain/models/appSettings';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { applyLanguage } from '@/presentation/i18n';
import { useTranslation } from '@/presentation/i18n/useTranslation';

export function SettingsScreen() {
  const { t } = useTranslation();
  const state = useSettingsStore((s) => s.state);
  const load = useSettingsStore((s) => s.load);
  const setDefaultStackingMode = useSettingsStore((s) => s.setDefaultStackingMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

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
        <Text variant="bodyMedium">
          {t('common.errorLoading')}: {state.error.message}
        </Text>
      </View>
    );
  }

  async function onLanguageChange(next: LanguagePreference) {
    await setLanguage(next);
    await applyLanguage(next);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">{t('settings.stackingTitle')}</Text>
        <Text variant="bodySmall">{t('settings.stackingHint')}</Text>
        <SegmentedButtons
          value={state.value.defaultStackingMode}
          onValueChange={(v) => {
            void setDefaultStackingMode(v as BockStackingMode);
          }}
          buttons={[
            { value: BockStackingMode.sequential, label: t('settings.stackingSequential') },
            { value: BockStackingMode.doppelbock, label: t('settings.stackingDoppelbock') },
          ]}
        />
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">{t('settings.languageTitle')}</Text>
        <SegmentedButtons
          value={state.value.language}
          onValueChange={(v) => {
            void onLanguageChange(v as LanguagePreference);
          }}
          buttons={[
            { value: 'system', label: t('settings.languageSystem') },
            { value: 'de', label: t('settings.languageDe') },
            { value: 'en', label: t('settings.languageEn') },
          ]}
        />
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">{t('exportImport.exportBackupButton')}</Text>
        <Button
          mode="contained-tonal"
          icon="export"
          onPress={() => {
            void (async () => {
              try {
                const file = await exportBackup();
                await shareExport(file);
              } catch (e) {
                console.error(t('exportImport.exportFailed'), e);
              }
            })();
          }}
        >
          {t('exportImport.exportBackupButton')}
        </Button>
      </View>
    </ScrollView>
  );
}
