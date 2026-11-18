import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import type { RootStackParamList } from '@/navigation/types';
import { Platform, ScrollView, View } from 'react-native';
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

import { copyGame, isPointsGame, type Game } from '@/domain/models/game';
import { PointsGameDialog } from '@/presentation/widgets/PointsGameDialog';
import { gameRowsFor } from '@/domain/scoring/gamePoints';
import { formatDate, formatDateTime, formatTime, parseDateTime } from '@/domain/dateTimeInput';
import { allGames, gamesPerRound, type GameSheet } from '@/domain/models/gameSheet';
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
import { BockStackingMode, bockStackingModeFromJson } from '@/domain/scoring/bockStackingMode';
import { scoreFor, totalsFor } from '@/domain/scoring/scoreCalculator';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { exportSheet } from '@/application/export/exportService';
import { saveExportToFile, shareExport } from '@/data/export/fileShare';
import { sharePdf } from '@/data/export/pdfShare';
import { useSheetGroupListStore } from '@/application/stores/sheetGroupListStore';
import { useSheetStore } from '@/application/stores/sheetStore';
import { createPlayerLookup, resolveSheetPlayers } from '@/domain/models/playerLookup';
import { useTranslation } from '@/presentation/i18n/useTranslation';
import { Scoreboard } from '@/presentation/widgets/Scoreboard';
import { RoundSection } from '@/presentation/widgets/RoundSection';
import { effectiveSubstitutions, type Substitution } from '@/domain/models/substitution';
import { playerDisplayName } from '@/domain/models/player';
import { SubstitutionsDialog } from '@/presentation/screens/sheet/SubstitutionsDialog';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Sheet'>>();
  const theme = useTheme();
  const renameSheet = useSheetStore((s) => s.renameSheet);
  const setPlayedAt = useSheetStore((s) => s.setPlayedAt);
  const setStackingModeOverride = useSheetStore((s) => s.setStackingModeOverride);
  const deleteGame = useSheetStore((s) => s.deleteGame);
  const updateGame = useSheetStore((s) => s.updateGame);
  const setGroup = useSheetStore((s) => s.setGroup);
  const setSubstitutions = useSheetStore((s) => s.setSubstitutions);

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

  const settings = settingsState.status === 'data' ? settingsState.value : appSettingsFallback;
  const mode = effectiveStackingMode(sheet, settings.defaultStackingMode);

  // Berechnungen einmalig im Container.
  const { totals, levels, bockState, perGameRows, scoresByGame, pointsByGame } = useMemo(() => {
    const t = totalsFor(sheet, mode);
    const l = resolveBock(sheet, mode);
    const bs = sheet.rounds.length === 0 ? bockStateEmpty : currentBockState(sheet, mode);
    const rows = gameRowsFor(sheet, mode);
    const sByGame = new Map<string, ReturnType<typeof scoreFor>>();
    for (const game of allGames(sheet)) {
      if (isPointsGame(game)) continue;
      sByGame.set(game.id, scoreFor(game, l.get(game.id) ?? BockLevel.none));
    }
    const pByGame = new Map<string, ReadonlyMap<string, number>>(
      rows.map((r) => [r.gameId, r.pointsByPlayerId] as const),
    );
    return {
      totals: t,
      levels: l,
      bockState: bs,
      perGameRows: rows,
      scoresByGame: sByGame,
      pointsByGame: pByGame,
    };
  }, [sheet, mode]);

  const canAddGame = sheet.playerIds.length >= 4;

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [playedAtOpen, setPlayedAtOpen] = useState(false);
  const [playedAtDate, setPlayedAtDate] = useState('');
  const [playedAtTime, setPlayedAtTime] = useState('');
  const [playedAtError, setPlayedAtError] = useState(false);

  const openPlayedAt = useCallback(() => {
    setPlayedAtDate(formatDate(sheet.playedAt));
    setPlayedAtTime(formatTime(sheet.playedAt));
    setPlayedAtError(false);
    setPlayedAtOpen(true);
  }, [sheet.playedAt]);

  async function submitPlayedAt() {
    const parsed = parseDateTime(playedAtDate, playedAtTime);
    if (parsed === null) {
      setPlayedAtError(true);
      return;
    }
    await setPlayedAt(parsed);
    setPlayedAtOpen(false);
  }

  const [menuOpen, setMenuOpen] = useState(false);
  const [stackingDialogOpen, setStackingDialogOpen] = useState(false);
  const [stackingChoice, setStackingChoice] = useState<'default' | BockStackingMode>(
    sheet.stackingModeOverride ?? 'default',
  );

  const [substitutionsOpen, setSubstitutionsOpen] = useState(false);
  async function submitSubstitutions(subs: readonly Substitution[]) {
    setSubstitutionsOpen(false);
    try {
      await setSubstitutions(subs);
    } catch (e) {
      console.error(e);
    }
  }
  const substitutionLines = effectiveSubstitutions(sheet.playerIds, sheet.substitutions).map(
    (s) => {
      const sub = lookup.byId(s.substituteId);
      const main = lookup.byId(s.mainPlayerId);
      return t('sheet.substitutesFor', {
        substitute: sub !== null ? playerDisplayName(sub) : s.substituteId,
        name: main !== null ? playerDisplayName(main) : s.mainPlayerId,
      });
    },
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

  const openRename = useCallback(() => {
    setRenameValue(sheet.title ?? '');
    setRenameOpen(true);
  }, [sheet.title]);

  async function submitRename() {
    const v = renameValue.trim();
    await renameSheet(v === '' ? null : v);
    setRenameOpen(false);
  }

  const openStackingDialog = useCallback(() => {
    setStackingChoice(sheet.stackingModeOverride ?? 'default');
    setStackingDialogOpen(true);
  }, [sheet.stackingModeOverride]);

  async function submitStacking() {
    const v = stackingChoice === 'default' ? null : stackingChoice;
    await setStackingModeOverride(v);
    setStackingDialogOpen(false);
  }

  function openAddGame() {
    navigation.navigate('AddGame', { sheetId: sheet.id });
  }

  const [pointsGameTarget, setPointsGameTarget] = useState<Game | null>(null);

  function onEditGame(game: Game) {
    if (isPointsGame(game)) {
      setPointsGameTarget(game);
      return;
    }
    navigation.navigate('AddGame', { sheetId: sheet.id, gameId: game.id });
  }

  async function submitPointsGame(pointsByPlayerId: Record<string, number>) {
    const target = pointsGameTarget;
    setPointsGameTarget(null);
    if (target === null) return;
    await updateGame(copyGame(target, { pointsByPlayerId }));
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      title: sheet.title ?? t('sheet.titleFallback'),
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="pencil-outline" onPress={openRename} />
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} />}
          >
            <Menu.Item
              title={t('sheet.menuPlayedAt')}
              onPress={() => {
                setMenuOpen(false);
                openPlayedAt();
              }}
            />
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
            {sheet.groupId !== null && (
              <Menu.Item
                title={t('sheet.menuSubstitutions')}
                onPress={() => {
                  setMenuOpen(false);
                  setSubstitutionsOpen(true);
                }}
              />
            )}
            <Menu.Item
              title={
                Platform.OS === 'android'
                  ? t('exportImport.shareSheetMenu')
                  : t('exportImport.exportSheetMenu')
              }
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
            <Menu.Item
              title={t('exportImport.sharePdfMenu')}
              onPress={() => {
                setMenuOpen(false);
                void (async () => {
                  try {
                    await sharePdf(sheet.id);
                  } catch (e) {
                    console.error(t('exportImport.exportFailed'), e);
                  }
                })();
              }}
            />
            {Platform.OS === 'android' && (
              <Menu.Item
                title={t('exportImport.saveSheetMenu')}
                onPress={() => {
                  setMenuOpen(false);
                  void (async () => {
                    try {
                      const file = await exportSheet(sheet.id);
                      await saveExportToFile(file);
                    } catch (e) {
                      console.error(t('exportImport.exportFailed'), e);
                    }
                  })();
                }}
              />
            )}
          </Menu>
        </View>
      ),
    });
  }, [navigation, sheet.title, sheet.id, t, menuOpen, openRename, openPlayedAt, openStackingDialog, sheet.groupId]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <Scoreboard
          players={players}
          totalsByPlayerId={totals.totalsByPlayerId}
          pointsByGame={perGameRows}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('sheet.playedAtLabel', { date: formatDateTime(sheet.playedAt) })}
          </Text>
        </View>

        {sheet.groupId !== null && substitutionLines.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {substitutionLines.map((line) => (
              <Text key={line} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {bockState.level !== BockLevel.none && (
          <BockBanner bockState={bockState} roundLength={gamesPerRound(sheet)} />
        )}

        {sheet.rounds.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Icon source="chart-line" size={56} color={theme.colors.primary} />
            <Text variant="titleMedium">{t('sheet.emptyTitle')}</Text>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              {t('sheet.emptyHint')}
            </Text>
          </View>
        ) : (
          [...sheet.rounds].reverse().map((r) => (
            <RoundSection
              key={r.index}
              round={r}
              players={players}
              scoresByGame={scoresByGame}
              bockLevelByGame={levels}
              pointsByGame={pointsByGame}
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
        <SubstitutionsDialog
          visible={substitutionsOpen}
          sheet={sheet}
          sheetPlayers={players}
          pool={pool}
          onDismiss={() => setSubstitutionsOpen(false)}
          onSave={(subs) => void submitSubstitutions(subs)}
        />
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

        <PointsGameDialog
          visible={pointsGameTarget !== null}
          game={pointsGameTarget}
          players={players}
          onDismiss={() => setPointsGameTarget(null)}
          onSubmit={(pts) => void submitPointsGame(pts)}
        />

        <Dialog visible={playedAtOpen} onDismiss={() => setPlayedAtOpen(false)}>
          <Dialog.Title>{t('sheet.playedAtTitle')}</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TextInput
              mode="outlined"
              label={t('sheet.playedAtDateLabel')}
              value={playedAtDate}
              onChangeText={(v) => {
                setPlayedAtDate(v);
                setPlayedAtError(false);
              }}
              keyboardType="numbers-and-punctuation"
              error={playedAtError}
              autoFocus
            />
            <TextInput
              mode="outlined"
              label={t('sheet.playedAtTimeLabel')}
              value={playedAtTime}
              onChangeText={(v) => {
                setPlayedAtTime(v);
                setPlayedAtError(false);
              }}
              keyboardType="numbers-and-punctuation"
              error={playedAtError}
            />
            {playedAtError && (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {t('sheet.playedAtInvalid')}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPlayedAtOpen(false)}>{t('common.cancel')}</Button>
            <Button mode="contained" onPress={() => void submitPlayedAt()}>
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
                setStackingChoice(v === 'default' ? 'default' : bockStackingModeFromJson(v))
              }
            >
              <RadioButton.Item label={t('sheet.stackingUseDefault')} value="default" />
              <RadioButton.Item
                label={t('sheet.stackingSequential')}
                value={BockStackingMode.sequential}
              />
              <RadioButton.Item
                label={t('sheet.stackingDoppelbock')}
                value={BockStackingMode.doppelbock}
              />
              <RadioButton.Item label={t('sheet.stackingOff')} value={BockStackingMode.off} />
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
                  label={t('sheet.groupOptionWithType', {
                    name: g.name,
                    type: t(groupTypeLabelKey(g.type)),
                  })}
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

function BockBanner({
  bockState,
  roundLength,
}: {
  bockState: ReturnType<typeof currentBockState>;
  roundLength: number;
}) {
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
      lines.push(
        t('sheet.bockSingleActive', {
          played: Math.max(0, roundLength - bockState.remainingSingle),
          total: roundLength,
        }),
      );
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
            <Text key={l} style={{ color: theme.colors.onTertiaryContainer, fontWeight: '600' }}>
              {l}
            </Text>
          ))}
        </View>
      </View>
    </Card>
  );
}
