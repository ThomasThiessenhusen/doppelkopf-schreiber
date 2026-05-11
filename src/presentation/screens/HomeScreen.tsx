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
  Menu,
  Portal,
  Text,
} from 'react-native-paper';

import type { GameSheet } from '@/domain/models/gameSheet';
import { useSheetListStore } from '@/application/stores/sheetListStore';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateTime(d: Date): string {
  return (
    `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

function defaultTitle(sheet: GameSheet): string {
  return `Spielbogen ${formatDateTime(sheet.createdAt)}`;
}

function totalGamesOf(sheet: GameSheet): number {
  let n = 0;
  for (const r of sheet.rounds) n += r.games.length;
  return n;
}

export function HomeScreen() {
  const router = useRouter();
  const loading = useSheetListStore((s) => s.loading);
  const sheets = useSheetListStore((s) => s.sheets);
  const error = useSheetListStore((s) => s.error);
  const refresh = useSheetListStore((s) => s.refresh);
  const deleteSheet = useSheetListStore((s) => s.deleteSheet);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [deleteTarget, setDeleteTarget] = useState<GameSheet | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);

  async function confirmDelete() {
    if (deleteTarget === null) return;
    await deleteSheet(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && sheets.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error !== null && sheets.length === 0 ? (
        <ErrorView error={error} onRetry={() => void refresh()} />
      ) : sheets.length === 0 ? (
        <EmptyView />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
          data={sheets}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
          }
          renderItem={({ item: sheet }) => {
            const metaLine =
              `${sheet.players.length} Spieler  ·  ` +
              `${totalGamesOf(sheet)} Spiele  ·  ` +
              `${formatDateTime(sheet.updatedAt)}`;
            return (
              <Card style={{ marginHorizontal: 12, marginVertical: 4 }}>
                <Card.Title
                  title={sheet.title ?? defaultTitle(sheet)}
                  titleNumberOfLines={1}
                  subtitle={metaLine}
                  subtitleNumberOfLines={2}
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
                        title="Loeschen"
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
                    Oeffnen
                  </Button>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}

      <FAB
        icon="plus"
        label="Neuer Spielbogen"
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={() => router.push('/sheets/new')}
      />

      <Portal>
        <Dialog visible={deleteTarget !== null} onDismiss={() => setDeleteTarget(null)}>
          <Dialog.Title>Spielbogen loeschen?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Der Spielbogen {'„'}
              {deleteTarget?.title ?? (deleteTarget !== null ? defaultTitle(deleteTarget) : '')}
              {'“'} wird endgueltig geloescht.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button mode="contained-tonal" onPress={() => void confirmDelete()}>
              Loeschen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function EmptyView() {
  return (
    <View
      style={{ flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <Text variant="headlineSmall">Noch keine Spielbogen</Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        Tippe auf {'„'}Neuer Spielbogen{'“'}, um den ersten Spielbogen anzulegen.
      </Text>
    </View>
  );
}

function ErrorView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View
      style={{ flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <Text variant="bodyLarge">Fehler beim Laden:</Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {error.message}
      </Text>
      <Button mode="contained" onPress={onRetry}>
        Erneut versuchen
      </Button>
    </View>
  );
}
