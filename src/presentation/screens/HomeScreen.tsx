import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  FAB,
  IconButton,
  List,
  Menu,
  Modal,
  Portal,
  Text,
} from 'react-native-paper';

import { groupTypeLabelKey } from '@/domain/models/groupType';
import type { GameSheet } from '@/domain/models/gameSheet';
import { useSheetGroupListStore } from '@/application/stores/sheetGroupListStore';
import { useSheetListStore } from '@/application/stores/sheetListStore';
import { useTranslation } from '@/presentation/i18n/useTranslation';

type TFunc = (k: string, p?: Record<string, unknown>) => string;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateTime(d: Date): string {
  return (
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

function defaultTitle(t: TFunc, sheet: GameSheet): string {
  return t('home.defaultTitle', { date: formatDateTime(sheet.createdAt) });
}

function totalGamesOf(sheet: GameSheet): number {
  let n = 0;
  for (const r of sheet.rounds) n += r.games.length;
  return n;
}

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loading = useSheetListStore((s) => s.loading);
  const sheets = useSheetListStore((s) => s.sheets);
  const error = useSheetListStore((s) => s.error);
  const refresh = useSheetListStore((s) => s.refresh);
  const deleteSheet = useSheetListStore((s) => s.deleteSheet);

  const groups = useSheetGroupListStore((s) => s.groups);
  const refreshGroups = useSheetGroupListStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
    void refreshGroups();
  }, [refresh, refreshGroups]);

  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameSheet | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);

  useEffect(() => {
    if (filterGroupId !== null && !groups.some((g) => g.id === filterGroupId)) {
      setFilterGroupId(null);
    }
  }, [filterGroupId, groups]);

  const activeGroup =
    filterGroupId === null ? null : groups.find((g) => g.id === filterGroupId) ?? null;
  const visibleSheets =
    filterGroupId === null ? sheets : sheets.filter((s) => s.groupId === filterGroupId);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name] as const));

  async function confirmDelete() {
    if (deleteTarget === null) return;
    await deleteSheet(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <Button
          mode="outlined"
          icon="filter-variant"
          style={{ flex: 1 }}
          onPress={() => setFilterSheetOpen(true)}
        >
          {activeGroup === null
            ? t('home.filterAll')
            : t('home.filterGroupSummary', {
                name: activeGroup.name,
                type: t(groupTypeLabelKey(activeGroup.type)),
              })}
        </Button>
        {activeGroup !== null && (
          <Button
            mode="contained-tonal"
            icon="podium"
            onPress={() =>
              router.push({
                pathname: '/groups/[groupId]/rankings',
                params: { groupId: activeGroup.id },
              })
            }
          >
            {t('home.rankings')}
          </Button>
        )}
      </View>

      {loading && sheets.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error !== null && sheets.length === 0 ? (
        <ErrorView error={error} onRetry={() => void refresh()} />
      ) : visibleSheets.length === 0 ? (
        <EmptyView
          activeGroupName={activeGroup?.name ?? null}
          onClearFilter={
            filterGroupId === null ? undefined : () => setFilterGroupId(null)
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
          data={visibleSheets}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
          }
          renderItem={({ item: sheet }) => {
            const metaLine = t('home.metaLine', {
              playerCount: sheet.players.length,
              gameCount: totalGamesOf(sheet),
              time: formatDateTime(sheet.updatedAt),
            });
            const groupName =
              sheet.groupId === null ? null : groupNameById.get(sheet.groupId) ?? null;
            return (
              <Card style={{ marginHorizontal: 12, marginVertical: 4 }}>
                <Card.Title
                  title={sheet.title ?? defaultTitle(t, sheet)}
                  titleNumberOfLines={1}
                  subtitle={
                    groupName === null
                      ? metaLine
                      : `📁 ${groupName}\n${metaLine}`
                  }
                  subtitleNumberOfLines={3}
                  right={() => (
                    <Menu
                      visible={menuForId === sheet.id}
                      onDismiss={() => setMenuForId(null)}
                      anchor={
                        <IconButton
                          icon="dots-vertical"
                          onPress={() => setMenuForId(sheet.id)}
                        />
                      }
                    >
                      <Menu.Item
                        title={t('home.deleteMenu')}
                        onPress={() => {
                          setMenuForId(null);
                          setDeleteTarget(sheet);
                        }}
                      />
                    </Menu>
                  )}
                />
                <Card.Content>
                  <Button
                    mode="contained-tonal"
                    onPress={() =>
                      router.push({
                        pathname: '/sheets/[sheetId]',
                        params: { sheetId: sheet.id },
                      })
                    }
                  >
                    {t('home.open')}
                  </Button>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}

      <FAB
        icon="plus"
        label={t('home.newSheet')}
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={() => {
          if (filterGroupId !== null) {
            router.push({
              pathname: '/sheets/new',
              params: { groupId: filterGroupId },
            });
          } else {
            router.push('/sheets/new');
          }
        }}
      />

      <Portal>
        <Modal
          visible={filterSheetOpen}
          onDismiss={() => setFilterSheetOpen(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            margin: 16,
            borderRadius: 12,
            padding: 8,
          }}
        >
          <List.Item
            title={t('home.filterAll')}
            left={(p) => <List.Icon {...p} icon="format-list-bulleted" />}
            onPress={() => {
              setFilterGroupId(null);
              setFilterSheetOpen(false);
            }}
          />
          {groups.map((g) => (
            <List.Item
              key={g.id}
              title={g.name}
              description={t(groupTypeLabelKey(g.type))}
              left={(p) => <List.Icon {...p} icon="folder-outline" />}
              onPress={() => {
                setFilterGroupId(g.id);
                setFilterSheetOpen(false);
              }}
            />
          ))}
          <List.Item
            title={t('home.managementGroups')}
            left={(p) => <List.Icon {...p} icon="tune" />}
            onPress={() => {
              setFilterSheetOpen(false);
              router.push('/groups');
            }}
          />
        </Modal>

        <Dialog visible={deleteTarget !== null} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Title>{t('home.deleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('home.deleteBody', {
                title:
                  deleteTarget?.title ??
                  (deleteTarget !== null ? defaultTitle(t, deleteTarget) : ''),
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button mode="contained-tonal" onPress={() => void confirmDelete()}>
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function EmptyView({
  activeGroupName,
  onClearFilter,
}: {
  activeGroupName: string | null;
  onClearFilter?: () => void;
}) {
  const { t } = useTranslation();
  const filtered = activeGroupName !== null;
  return (
    <View
      style={{ flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <Text variant="headlineSmall">
        {filtered
          ? t('home.emptyFiltered', { groupName: activeGroupName })
          : t('home.emptyAll')}
      </Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {filtered ? t('home.emptyHintFiltered') : t('home.emptyHintAll')}
      </Text>
      {onClearFilter !== undefined && (
        <Button mode="contained-tonal" icon="filter-off" onPress={onClearFilter}>
          {t('home.clearFilter')}
        </Button>
      )}
    </View>
  );
}

function ErrorView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View
      style={{ flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <Text variant="bodyLarge">{t('common.errorLoading')}:</Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {error.message}
      </Text>
      <Button mode="contained" onPress={onRetry}>
        {t('common.retry')}
      </Button>
    </View>
  );
}
