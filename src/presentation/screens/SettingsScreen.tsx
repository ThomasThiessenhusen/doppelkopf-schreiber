import { useEffect } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, SegmentedButtons, Text } from 'react-native-paper';

import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';

import { exportBackup } from '@/application/export/exportService';
import { saveExportToFile, shareExport } from '@/data/export/fileShare';
import type { LanguagePreference } from '@/domain/models/appSettings';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { applyLanguage } from '@/presentation/i18n';
import { storageModeKey } from '@/presentation/i18n/storageModeKey';
import { useTranslation } from '@/presentation/i18n/useTranslation';
import { useStorageMode } from '@/presentation/hooks/useStorageMode';

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const state = useSettingsStore((s) => s.state);
  const load = useSettingsStore((s) => s.load);
  const setDefaultStackingMode = useSettingsStore((s) => s.setDefaultStackingMode);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const storageMode = useStorageMode();

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
          {Platform.OS === 'android'
            ? t('exportImport.shareBackupButton')
            : t('exportImport.exportBackupButton')}
        </Button>
        {Platform.OS === 'android' && (
          <Button
            mode="contained-tonal"
            icon="content-save"
            onPress={() => {
              void (async () => {
                try {
                  const file = await exportBackup();
                  await saveExportToFile(file);
                } catch (e) {
                  console.error(t('exportImport.exportFailed'), e);
                }
              })();
            }}
          >
            {t('exportImport.saveBackupButton')}
          </Button>
        )}
        <Button
          mode="contained-tonal"
          icon="import"
          onPress={() => {
            void (async () => {
              const res = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
                multiple: false,
              });
              if (res.canceled === true) return;
              const uri = res.assets?.[0]?.uri;
              if (typeof uri !== 'string') return;
              navigation.navigate('ImportReview', { fileUri: uri });
            })();
          }}
        >
          {t('exportImport.importButton')}
        </Button>
      </View>

      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">{t('storage.title')}</Text>
        <Text variant="bodySmall">
          {storageMode === null ? t('common.loading') : t(storageModeKey(storageMode))}
        </Text>
      </View>
    </ScrollView>
  );
}
