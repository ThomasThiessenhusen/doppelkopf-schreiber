import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, Divider, List, Text, useTheme } from 'react-native-paper';

import { appSettingsFallback } from '@/domain/models/appSettings';
import { calculateGroupRankings } from '@/domain/scoring/groupRankingCalculator';
import type { RankingEntry } from '@/domain/scoring/groupRankings';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { useSheetGroupListStore } from '@/application/stores/sheetGroupListStore';
import { useSheetListStore } from '@/application/stores/sheetListStore';
import { createPlayerLookup } from '@/domain/models/playerLookup';
import { useTranslation } from '@/presentation/i18n/useTranslation';

export function GroupRankingsScreen({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const groupsLoading = useSheetGroupListStore((s) => s.loading);
  const groups = useSheetGroupListStore((s) => s.groups);
  const refreshGroups = useSheetGroupListStore((s) => s.refresh);

  const sheetsLoading = useSheetListStore((s) => s.loading);
  const sheets = useSheetListStore((s) => s.sheets);
  const refreshSheets = useSheetListStore((s) => s.refresh);

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);

  const pool = usePlayerListStore((s) => s.players);
  const refreshPool = usePlayerListStore((s) => s.refresh);

  useEffect(() => {
    void refreshGroups();
    void refreshSheets();
    void loadSettings();
    void refreshPool();
  }, [refreshGroups, refreshSheets, loadSettings, refreshPool]);

  const group = groups.find((g) => g.id === groupId);
  const settings =
    settingsState.status === 'data' ? settingsState.value : appSettingsFallback;

  const rankings = useMemo(() => {
    const inGroup = sheets.filter((s) => s.groupId === groupId);
    const lookup = createPlayerLookup(pool);
    return calculateGroupRankings({
      sheets: inGroup,
      defaultMode: settings.defaultStackingMode,
      lookup,
    });
  }, [sheets, groupId, settings.defaultStackingMode, pool]);

  if (groupsLoading || sheetsLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (group === undefined) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text>{t('groups.rankings.groupNotFound')}</Text>
      </View>
    );
  }

  const isEmpty =
    rankings.placementPoints.length === 0 &&
    rankings.totalPoints.length === 0 &&
    rankings.wonSoli.length === 0;

  if (isEmpty) {
    return (
      <View style={{ flex: 1, padding: 32, justifyContent: 'center' }}>
        <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
          {t('groups.rankings.empty')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <RankingSection
        title={t('groups.rankings.byPlacement')}
        entries={rankings.placementPoints}
        formatValue={(v) => String(v)}
        colorize={false}
      />
      <RankingSection
        title={t('groups.rankings.byPoints')}
        entries={rankings.totalPoints}
        formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
        colorize
      />
      <RankingSection
        title={t('groups.rankings.bySoli')}
        entries={rankings.wonSoli}
        formatValue={(v) => String(v)}
        colorize={false}
      />
    </ScrollView>
  );
}

function RankingSection({
  title,
  entries,
  formatValue,
  colorize,
}: {
  title: string;
  entries: ReadonlyArray<RankingEntry>;
  formatValue: (v: number) => string;
  colorize: boolean;
}) {
  const theme = useTheme();
  function colorFor(v: number): string | undefined {
    if (!colorize) return undefined;
    if (v > 0) return theme.colors.primary;
    if (v < 0) return theme.colors.error;
    return undefined;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text variant="titleMedium">{title}</Text>
      <Card mode="contained">
        {entries.map((e, i) => (
          <View key={e.playerId}>
            {i > 0 && <Divider />}
            <List.Item
              title={e.displayName}
              left={() => (
                <View style={{ width: 32, justifyContent: 'center' }}>
                  <Text
                    style={{
                      textAlign: 'right',
                      fontVariant: ['tabular-nums'],
                      fontWeight: '600',
                    }}
                  >
                    {e.rank}.
                  </Text>
                </View>
              )}
              right={() => (
                <View style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
                  <Text
                    style={{
                      fontVariant: ['tabular-nums'],
                      fontWeight: '600',
                      color: colorFor(e.value),
                    }}
                  >
                    {formatValue(e.value)}
                  </Text>
                </View>
              )}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}
