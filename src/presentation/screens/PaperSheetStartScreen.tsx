import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';

import { buildScanPrompt } from '@/application/import/scanPrompt';
import { parseScanText, ScanParseError } from '@/application/import/scanParser';
import { emptyGrid, gridFromScan } from '@/application/paper/paperGrid';
import { usePaperDraftStore } from '@/application/stores/paperDraftStore';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { pickImportFile } from '@/data/import/pickImportFile';
import { readTextFile } from '@/data/local/readTextFile';
import { sharePromptText } from '@/data/share/sharePromptText';
import type { RootStackParamList } from '@/navigation/types';
import { useTranslation } from '@/presentation/i18n/useTranslation';

/** Einstieg: leeres Raster oder Vorbelegung aus einer KI-Abschrift. */
export function PaperSheetStartScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setGrid = usePaperDraftStore((s) => s.setGrid);

  const pool = usePlayerListStore((s) => s.players);
  const refreshPool = usePlayerListStore((s) => s.refresh);
  useEffect(() => {
    void refreshPool();
  }, [refreshPool]);

  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const prompt = useMemo(
    () => buildScanPrompt(i18n.language.startsWith('en') ? 'en' : 'de'),
    [i18n.language],
  );

  function startEmpty(playerCount: 4 | 5) {
    setGrid(emptyGrid(playerCount, new Date()));
    navigation.navigate('PaperSheetGrid');
  }

  function continueWithText(text: string) {
    try {
      const scan = parseScanText(text);
      setGrid(gridFromScan(scan, pool));
      setError(null);
      navigation.navigate('PaperSheetGrid');
    } catch (e) {
      const message = e instanceof ScanParseError ? e.message : String(e);
      setError(t('paperImport.parseError', { message }));
    }
  }

  async function sharePrompt() {
    setInfo(null);
    try {
      const result = await sharePromptText(prompt);
      if (result === 'copied') setInfo(t('paperImport.promptCopied'));
    } catch {
      setError(t('paperImport.promptFailed'));
    }
  }

  async function pickFile() {
    setError(null);
    const res = await pickImportFile();
    if (res.status === 'cancelled') return;
    try {
      continueWithText(await readTextFile(res.uri));
    } catch {
      setError(t('paperImport.fileReadFailed'));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text variant="bodyMedium">{t('paperImport.intro')}</Text>

      <View style={{ gap: 8 }}>
        <Button mode="contained-tonal" icon="table" onPress={() => startEmpty(4)}>
          {t('paperImport.emptyGrid4')}
        </Button>
        <Button mode="contained-tonal" icon="table" onPress={() => startEmpty(5)}>
          {t('paperImport.emptyGrid5')}
        </Button>
      </View>

      <Card>
        <Card.Title title={t('paperImport.aiTitle')} />
        <Card.Content style={{ gap: 12 }}>
          <Text variant="bodySmall">{t('paperImport.aiIntro')}</Text>
          <Button mode="outlined" icon="share-variant" onPress={() => void sharePrompt()}>
            {t('paperImport.sharePrompt')}
          </Button>
          {info !== null && <HelperText type="info">{info}</HelperText>}
          <TextInput
            mode="outlined"
            multiline
            numberOfLines={6}
            label={t('paperImport.pasteLabel')}
            value={pasted}
            onChangeText={(text) => {
              setPasted(text);
              setError(null);
            }}
            style={{ maxHeight: 200 }}
          />
          {error !== null && <HelperText type="error">{error}</HelperText>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button mode="outlined" icon="file-import-outline" onPress={() => void pickFile()}>
              {t('paperImport.pickFile')}
            </Button>
            <Button
              mode="contained"
              disabled={pasted.trim() === ''}
              onPress={() => continueWithText(pasted)}
            >
              {t('paperImport.next')}
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
