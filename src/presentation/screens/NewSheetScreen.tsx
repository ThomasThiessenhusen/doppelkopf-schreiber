import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { createGameSheet } from '@/domain/models/gameSheet';
import { playerDisplayName, type Player } from '@/domain/models/player';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { useSheetListStore } from '@/application/stores/sheetListStore';

export function NewSheetScreen() {
  const router = useRouter();

  const playersLoading = usePlayerListStore((s) => s.loading);
  const players = usePlayerListStore((s) => s.players);
  const refreshPlayers = usePlayerListStore((s) => s.refresh);

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);

  const createSheet = useSheetListStore((s) => s.createSheet);

  useEffect(() => {
    void refreshPlayers();
  }, [refreshPlayers]);
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const [title, setTitle] = useState('');
  const [playerCount, setPlayerCount] = useState<4 | 5>(4);
  const [selected, setSelected] = useState<Player[]>([]);
  const [stackingOverride, setStackingOverride] = useState<BockStackingMode | null>(null);

  const settings =
    settingsState.status === 'data' ? settingsState.value : appSettingsFallback;
  const selectedMode = stackingOverride ?? settings.defaultStackingMode;

  const canSubmit = selected.length === playerCount;

  function togglePlayer(p: Player) {
    setSelected((curr) => {
      const i = curr.findIndex((s) => s.id === p.id);
      if (i >= 0) {
        return [...curr.slice(0, i), ...curr.slice(i + 1)];
      }
      if (curr.length >= playerCount) return curr;
      return [...curr, p];
    });
  }

  function onPlayerCountChanged(next: 4 | 5) {
    setPlayerCount(next);
    setSelected((curr) => (curr.length > next ? curr.slice(0, next) : curr));
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setSelected((curr) => {
      const next = [...curr];
      const prev = next[index - 1]!;
      const here = next[index]!;
      next[index - 1] = here;
      next[index] = prev;
      return next;
    });
  }

  function moveDown(index: number) {
    setSelected((curr) => {
      if (index >= curr.length - 1) return curr;
      const next = [...curr];
      const here = next[index]!;
      const after = next[index + 1]!;
      next[index] = after;
      next[index + 1] = here;
      return next;
    });
  }

  async function create() {
    const sheet = {
      ...createGameSheet({
        players: selected,
        title: title.trim() === '' ? null : title.trim(),
      }),
      stackingModeOverride: selectedMode,
    };
    await createSheet(sheet);
    router.replace({ pathname: '/sheets/[sheetId]', params: { sheetId: sheet.id } });
  }

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <TextInput
        label="Titel (optional)"
        placeholder="z. B. Stammtisch Mai"
        mode="outlined"
        value={title}
        onChangeText={setTitle}
      />

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">Anzahl Spieler</Text>
        <SegmentedButtons
          value={String(playerCount)}
          onValueChange={(v) => onPlayerCountChanged(v === '5' ? 5 : 4)}
          buttons={[
            { value: '4', label: '4 Spieler' },
            { value: '5', label: '5 Spieler' },
          ]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">Bockrunden-Stapelung</Text>
        <Text variant="bodySmall">
          Vorausgewaehlt ist der App-Default — fuer diesen Bogen aenderbar.
        </Text>
        <SegmentedButtons
          value={selectedMode}
          onValueChange={(v) => setStackingOverride(v as BockStackingMode)}
          buttons={[
            { value: BockStackingMode.sequential, label: 'Sequenziell' },
            { value: BockStackingMode.doppelbock, label: 'Doppelbock' },
          ]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="titleMedium" style={{ flex: 1 }}>
            Spieler auswaehlen
          </Text>
          <Text variant="bodySmall">
            {selected.length} / {playerCount}
          </Text>
        </View>

        {playersLoading && players.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : players.length === 0 ? (
          <Card>
            <Card.Content style={{ gap: 8 }}>
              <Text variant="titleSmall">Noch keine Spieler im Pool</Text>
              <Text variant="bodySmall">
                Lege zuerst in der Spielerverwaltung Spieler an.
              </Text>
              <Button mode="contained-tonal" onPress={() => router.push('/players')}>
                Spielerverwaltung oeffnen
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {players.map((p) => (
              <Chip
                key={p.id}
                selected={selectedIds.has(p.id)}
                onPress={() => {
                  if (
                    !selectedIds.has(p.id) &&
                    selected.length >= playerCount
                  ) {
                    return;
                  }
                  togglePlayer(p);
                }}
              >
                {playerDisplayName(p)}
              </Chip>
            ))}
          </View>
        )}
      </View>

      {selected.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text variant="titleMedium">Reihenfolge</Text>
          <Text variant="bodySmall">
            Position 1 ist der erste Aussetzer/Kartengeber. Mit den Pfeilen umsortieren.
          </Text>
          {selected.map((p, index) => {
            const isFirst = index === 0;
            const isLast = index === selected.length - 1;
            return (
              <Card key={p.id} mode="contained">
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}
                >
                  <Text
                    variant="titleMedium"
                    style={{ width: 32, textAlign: 'center' }}
                  >
                    {index + 1}
                  </Text>
                  <View style={{ flex: 1, paddingVertical: 12 }}>
                    <Text variant="bodyLarge">{playerDisplayName(p)}</Text>
                    {isFirst && (
                      <Text variant="bodySmall">Erster Aussetzer/Kartengeber</Text>
                    )}
                  </View>
                  <IconButton
                    icon="arrow-up"
                    disabled={isFirst}
                    onPress={() => moveUp(index)}
                  />
                  <IconButton
                    icon="arrow-down"
                    disabled={isLast}
                    onPress={() => moveDown(index)}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Button
        mode="contained"
        icon="check"
        disabled={!canSubmit}
        onPress={() => void create()}
      >
        Spielbogen erstellen
      </Button>
    </ScrollView>
  );
}
