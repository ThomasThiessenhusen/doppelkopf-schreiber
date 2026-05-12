import { Stack, useRouter } from 'expo-router';
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
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import type { Game } from '@/domain/models/game';
import { allGames, type GameSheet } from '@/domain/models/gameSheet';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { GroupType, groupTypeLabelKey } from '@/domain/models/groupType';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import { BockLevel } from '@/domain/scoring/bockLevel';
import {
  bockStateEmpty,
  currentBockState,
  effectiveStackingMode,
  resolveBock,
} from '@/domain/scoring/bockResolver';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { scoreFor, totalsFor } from '@/domain/scoring/scoreCalculator';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { exportSheet } from '@/application/export/exportService';
import { shareExport } from '@/data/export/fileShare';
import { useSheetGroupListStore } from '@/application/stores/sheetGroupListStore';
import { useSheetStore } from '@/application/stores/sheetStore';
import {
  createPlayerLookup,
  resolveSheetPlayers,
} from '@/domain/models/playerLookup';
import { useTranslation } from '@/presentation/i18n/useTranslation';
import { Scoreboard } from '@/presentation/widgets/Scoreboard';
import { RoundSection } from '@/presentation/widgets/RoundSection';

export function SheetScreen({ sheetId }: { sheetId: string }) {
  const { t } = useTranslation();
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
        <Text variant="bodyMedium">{`${t('sheet.errorPrefix')}: ${state.error.message}`}</Text>
      </View>
    );
  }

  return <Loaded sheet={state.value} />;
}

function Loaded({ sheet }: { sheet: GameSheet }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const renameSheet = useSheetStore((s) => s.renameSheet);
  const setStackingModeOverride = useSheetStore((s) => s.setStackingModeOverride);
  const deleteGame = useSheetStore((s) => s.deleteGame);
  const setGroup = useSheetStore((s) => s.setGroup);

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const groups = useSheetGroupListStore((s) => s.groups);
  const refreshGroups = useSheetGroupListStore((s) => s.refresh);
  const createGroup = useSheetGroupListStore((s) => s.create);
  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  const pool = usePlayerListStore((s) => s.players);
  const refreshPool = usePlayerListStore((s) => s.refresh);
  useEffect(() => {
    void refreshPool();
  }, [refreshPool]);

  const lookup = useMemo(() => createPlayerLookup(pool), [pool]);
  const players = useMemo(() => resolveSheetPlayers(sheet, lookup), [sheet, lookup]);

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
      for (const p of players) {
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
  }, [sheet, mode, players]);

  const canAddGame = sheet.playerIds.length >= 4;

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [stackingDialogOpen, setStackingDialogOpen] = useState(false);
  const [stackingChoice, setStackingChoice] = useState<'default' | BockStackingMode>(
    sheet.stackingModeOverride ?? 'default',
  );

  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupNewOpen, setGroupNewOpen] = useState(false);
  const [groupNewName, setGroupNewName] = useState('');
  const [groupNewType, setGroupNewType] = useState<GroupType>(GroupType.season);

  async function pickExistingGroup(g: SheetGroup | null) {
    setGroupPickerOpen(false);
    await setGroup(g?.id ?? null);
  }
  function startCreateGroup() {
    setGroupPickerOpen(false);
    setGroupNewName('');
    setGroupNewType(GroupType.season);
    setGroupNewOpen(true);
  }
  async function submitCreateGroup() {
    const name = groupNewName.trim();
    if (name === '') {
      setGroupNewOpen(false);
      return;
    }
    const created = await createGroup({ name, type: groupNewType });
    setGroupNewOpen(false);
    await setGroup(created.id);
  }

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
      <Stack.Screen
        options={{
          title: sheet.title ?? t('sheet.titleFallback'),
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton icon="pencil-outline" onPress={openRename} />
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={
                  <IconButton
                    icon="dots-vertical"
                    onPress={() => setMenuOpen(true)}
                  />
                }
              >
                <Menu.Item
                  title={t('sheet.menuStacking')}
                  onPress={() => {
                    setMenuOpen(false);
                    openStackingDialog();
                  }}
                />
                <Menu.Item
                  title={t('sheet.menuGroup')}
                  onPress={() => {
                    setMenuOpen(false);
                    setGroupPickerOpen(true);
                  }}
                />
                <Menu.Item
                  title={t('exportImport.exportSheetMenu')}
                  onPress={() => {
                    setMenuOpen(false);
                    void (async () => {
                      try {
                        const file = await exportSheet(sheet.id);
                        await shareExport(file);
                      } catch (e) {
                        console.error(t('exportImport.exportFailed'), e);
                      }
                    })();
                  }}
                />
              </Menu>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <Scoreboard
          players={players}
          totalsByPlayerId={totals.totalsByPlayerId}
          pointsByGame={perGameRows}
        />

        {bockState.level !== BockLevel.none && <BockBanner bockState={bockState} />}

        {sheet.rounds.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Icon source="chart-line" size={56} color={theme.colors.primary} />
            <Text variant="titleMedium">{t('sheet.emptyTitle')}</Text>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              {t('sheet.emptyHint')}
            </Text>
          </View>
        ) : (
          sheet.rounds.map((r) => (
            <RoundSection
              key={r.index}
              round={r}
              players={players}
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
          label={t('sheet.addGameFab')}
          style={{ position: 'absolute', right: 16, bottom: 16 }}
          onPress={openAddGame}
        />
      )}

      <Portal>
        <Dialog visible={renameOpen} onDismiss={() => setRenameOpen(false)}>
          <Dialog.Title>{t('sheet.titleDialogTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t('sheet.titlePlaceholder')}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameOpen(false)}>{t('common.cancel')}</Button>
            <Button mode="contained" onPress={() => void submitRename()}>
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={stackingDialogOpen} onDismiss={() => setStackingDialogOpen(false)}>
          <Dialog.Title>{t('sheet.stackingTitle')}</Dialog.Title>
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
              <RadioButton.Item label={t('sheet.stackingUseDefault')} value="default" />
              <RadioButton.Item label={t('sheet.stackingSequential')} value={BockStackingMode.sequential} />
              <RadioButton.Item label={t('sheet.stackingDoppelbock')} value={BockStackingMode.doppelbock} />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStackingDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button mode="contained" onPress={() => void submitStacking()}>
              {t('sheet.apply')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={groupPickerOpen} onDismiss={() => setGroupPickerOpen(false)}>
          <Dialog.Title>{t('sheet.groupTitle')}</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={sheet.groupId ?? '__none__'}
              onValueChange={(v) => {
                if (v === '__none__') {
                  void pickExistingGroup(null);
                } else if (v === '__new__') {
                  startCreateGroup();
                } else {
                  const g = groups.find((x) => x.id === v);
                  void pickExistingGroup(g ?? null);
                }
              }}
            >
              <RadioButton.Item label={t('sheet.groupNone')} value="__none__" />
              {groups.map((g) => (
                <RadioButton.Item
                  key={g.id}
                  label={t('sheet.groupOptionWithType', { name: g.name, type: t(groupTypeLabelKey(g.type)) })}
                  value={g.id}
                />
              ))}
              <RadioButton.Item label={t('sheet.groupNewOption')} value="__new__" />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setGroupPickerOpen(false)}>{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={groupNewOpen} onDismiss={() => setGroupNewOpen(false)}>
          <Dialog.Title>{t('sheet.groupNewTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={t('sheet.groupNewName')}
              value={groupNewName}
              onChangeText={setGroupNewName}
              autoFocus
            />
            <View style={{ marginTop: 12 }}>
              <SegmentedButtons
                value={groupNewType}
                onValueChange={(v) => setGroupNewType(v as GroupType)}
                buttons={[
                  { value: GroupType.season, label: t('sheet.groupTypeSeason') },
                  { value: GroupType.tournament, label: t('sheet.groupTypeTournament') },
                ]}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setGroupNewOpen(false)}>{t('common.cancel')}</Button>
            <Button mode="contained" onPress={() => void submitCreateGroup()}>
              {t('sheet.groupCreate')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function BockBanner({ bockState }: { bockState: ReturnType<typeof currentBockState> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const lines: string[] = [];
  if (bockState.remainingDouble > 0) {
    lines.push(t('sheet.bockDoubleRemaining', { count: bockState.remainingDouble }));
  }
  if (bockState.remainingSingle > 0) {
    if (bockState.remainingDouble > 0) {
      lines.push(t('sheet.bockAfterDouble', { count: bockState.remainingSingle }));
    } else {
      lines.push(t('sheet.bockSingleActive', { count: bockState.remainingSingle }));
    }
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
