import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  FAB,
  Icon,
  IconButton,
  Menu,
  Portal,
  RadioButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import type { Game } from '@/domain/models/game';
import { allGames, type GameSheet } from '@/domain/models/gameSheet';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { BockLevel } from '@/domain/scoring/bockLevel';
import {
  bockStateEmpty,
  currentBockState,
  effectiveStackingMode,
  resolveBock,
} from '@/domain/scoring/bockResolver';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { scoreFor, totalsFor } from '@/domain/scoring/scoreCalculator';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { useSheetStore } from '@/application/stores/sheetStore';
import { Scoreboard } from '@/presentation/widgets/Scoreboard';
import { RoundSection } from '@/presentation/widgets/RoundSection';

export function SheetScreen({ sheetId }: { sheetId: string }) {
  const state = useSheetStore((s) => s.state);
  const load = useSheetStore((s) => s.load);

  useEffect(() => {
    void load(sheetId);
  }, [load, sheetId]);

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
        <Text variant="bodyMedium">Fehler: {state.error.message}</Text>
      </View>
    );
  }

  return <Loaded sheet={state.value} />;
}

function Loaded({ sheet }: { sheet: GameSheet }) {
  const router = useRouter();
  const theme = useTheme();
  const renameSheet = useSheetStore((s) => s.renameSheet);
  const setStackingModeOverride = useSheetStore((s) => s.setStackingModeOverride);
  const deleteGame = useSheetStore((s) => s.deleteGame);

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const settings =
    settingsState.status === 'data' ? settingsState.value : appSettingsFallback;
  const mode = effectiveStackingMode(sheet, settings.defaultStackingMode);

  // Berechnungen einmalig im Container.
  const { totals, levels, bockState, perGameRows, scoresByGame } = useMemo(() => {
    const t = totalsFor(sheet, mode);
    const l = resolveBock(sheet, mode);
    const bs = sheet.rounds.length === 0 ? bockStateEmpty : currentBockState(sheet, mode);
    const sByGame = new Map<string, ReturnType<typeof scoreFor>>();
    const rows: Array<{
      gameId: string;
      pointsByPlayerId: Map<string, number>;
      sittingOutPlayerId: string | null;
    }> = [];
    for (const game of allGames(sheet)) {
      const score = scoreFor(game, l.get(game.id) ?? BockLevel.none);
      sByGame.set(game.id, score);
      const points = new Map<string, number>();
      for (const p of sheet.players) {
        const isRe = game.rePlayerIds.includes(p.id);
        const isContra = game.contraPlayerIds.includes(p.id);
        points.set(p.id, isRe ? score.rePerPlayer : isContra ? score.contraPerPlayer : 0);
      }
      rows.push({
        gameId: game.id,
        pointsByPlayerId: points,
        sittingOutPlayerId: game.sittingOutPlayerId,
      });
    }
    return { totals: t, levels: l, bockState: bs, perGameRows: rows, scoresByGame: sByGame };
  }, [sheet, mode]);

  const canAddGame = sheet.players.length >= 4;

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [stackingDialogOpen, setStackingDialogOpen] = useState(false);
  const [stackingChoice, setStackingChoice] = useState<'default' | BockStackingMode>(
    sheet.stackingModeOverride ?? 'default',
  );

  function openRename() {
    setRenameValue(sheet.title ?? '');
    setRenameOpen(true);
  }

  async function submitRename() {
    const v = renameValue.trim();
    await renameSheet(v === '' ? null : v);
    setRenameOpen(false);
  }

  function openStackingDialog() {
    setStackingChoice(sheet.stackingModeOverride ?? 'default');
    setStackingDialogOpen(true);
  }

  async function submitStacking() {
    const v = stackingChoice === 'default' ? null : stackingChoice;
    await setStackingModeOverride(v);
    setStackingDialogOpen(false);
  }

  function openAddGame() {
    router.push({ pathname: '/sheets/[sheetId]/add-game', params: { sheetId: sheet.id } });
  }

  function onEditGame(game: Game) {
    router.push({
      pathname: '/sheets/[sheetId]/add-game',
      params: { sheetId: sheet.id, gameId: game.id },
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 8,
            gap: 4,
          }}
        >
          <Text variant="titleLarge" style={{ flex: 1 }} numberOfLines={1}>
            {sheet.title ?? 'Spielbogen'}
          </Text>
          <IconButton icon="pencil-outline" onPress={openRename} />
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} />}
          >
            <Menu.Item
              title="Bockrunden-Stapelung..."
              onPress={() => {
                setMenuOpen(false);
                openStackingDialog();
              }}
            />
          </Menu>
        </View>

        <Scoreboard
          players={sheet.players}
          totalsByPlayerId={totals.totalsByPlayerId}
          pointsByGame={perGameRows}
        />

        {bockState.level !== BockLevel.none && <BockBanner bockState={bockState} />}

        {sheet.rounds.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Icon source="chart-line" size={56} color={theme.colors.primary} />
            <Text variant="titleMedium">Noch keine Spiele eingetragen</Text>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              Tippe auf {'„'}Neues Spiel{'“'}, um das erste Spiel zu erfassen.
            </Text>
          </View>
        ) : (
          sheet.rounds.map((r) => (
            <RoundSection
              key={r.index}
              round={r}
              players={sheet.players}
              scoresByGame={scoresByGame}
              bockLevelByGame={levels}
              onEditGame={onEditGame}
              onDeleteGame={(g) => void deleteGame(g.id)}
            />
          ))
        )}
      </ScrollView>

      {canAddGame && (
        <FAB
          icon="plus"
          label="Neues Spiel"
          style={{ position: 'absolute', right: 16, bottom: 16 }}
          onPress={openAddGame}
        />
      )}

      <Portal>
        <Dialog visible={renameOpen} onDismiss={() => setRenameOpen(false)}>
          <Dialog.Title>Titel</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Titel des Spielbogens"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameOpen(false)}>Abbrechen</Button>
            <Button mode="contained" onPress={() => void submitRename()}>
              Speichern
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={stackingDialogOpen} onDismiss={() => setStackingDialogOpen(false)}>
          <Dialog.Title>Bockrunden-Stapelung</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={stackingChoice}
              onValueChange={(v) =>
                setStackingChoice(
                  v === 'default'
                    ? 'default'
                    : v === BockStackingMode.doppelbock
                      ? BockStackingMode.doppelbock
                      : BockStackingMode.sequential,
                )
              }
            >
              <RadioButton.Item label="App-Default verwenden" value="default" />
              <RadioButton.Item label="Sequenziell" value={BockStackingMode.sequential} />
              <RadioButton.Item label="Doppelbock" value={BockStackingMode.doppelbock} />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStackingDialogOpen(false)}>Abbrechen</Button>
            <Button mode="contained" onPress={() => void submitStacking()}>
              Uebernehmen
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function BockBanner({ bockState }: { bockState: ReturnType<typeof currentBockState> }) {
  const theme = useTheme();
  const lines: string[] = [];
  if (bockState.remainingDouble > 0) {
    lines.push(`Doppelbock — noch ${bockState.remainingDouble} Spiele`);
  }
  if (bockState.remainingSingle > 0) {
    const prefix = bockState.remainingDouble > 0 ? 'danach Bock' : 'Bockrunde aktiv';
    lines.push(`${prefix} — ${bockState.remainingSingle} Spiele`);
  }
  return (
    <Card
      style={{
        marginHorizontal: 12,
        marginVertical: 6,
        backgroundColor: theme.colors.tertiaryContainer,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          gap: 12,
        }}
      >
        <Icon source="fire" size={24} color={theme.colors.onTertiaryContainer} />
        <View style={{ flex: 1 }}>
          {lines.map((l) => (
            <Text
              key={l}
              style={{ color: theme.colors.onTertiaryContainer, fontWeight: '600' }}
            >
              {l}
            </Text>
          ))}
        </View>
      </View>
    </Card>
  );
}
