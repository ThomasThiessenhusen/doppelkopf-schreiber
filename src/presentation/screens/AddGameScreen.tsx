import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/presentation/i18n/useTranslation';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Icon,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';

import { createGame, type Game, WinnerSide } from '@/domain/models/game';
import {
  allGames,
  type GameSheet,
  replaceGame,
  sheetWithGame,
} from '@/domain/models/gameSheet';
import { type Player } from '@/domain/models/player';
import { FlagGroup, type ScoreFlag, FlagTarget } from '@/domain/models/scoreFlag';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { BockLevel } from '@/domain/scoring/bockLevel';
import { effectiveStackingMode, resolveBock } from '@/domain/scoring/bockResolver';
import { scoreFor } from '@/domain/scoring/scoreCalculator';
import { selectableFlags } from '@/domain/scoring/scoringRules';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { useSheetStore } from '@/application/stores/sheetStore';
import { FlagChip } from '@/presentation/widgets/FlagChip';
import { TeamPicker } from '@/presentation/widgets/TeamPicker';
import {
  announcementLabel,
  contraAnnouncementCodes,
  doppelkopfSpec,
  fuchsSpec,
  levelCodes,
  reAnnouncementCodes,
  stepsPerSide,
  type AnnouncementSide,
  type StackingCounterSpec,
} from '@/presentation/screens/addGame/flagSpecs';
import {
  flagImplications,
  isFlagBlockedByConflict,
  mutuallyExclusiveCounterparts,
} from '@/presentation/screens/addGame/flagConflicts';

function nextSittingOutOfSheet(sheet: GameSheet): Player | null {
  if (sheet.players.length !== 5) return null;
  let totalGames = 0;
  for (const r of sheet.rounds) totalGames += r.games.length;
  const idx = totalGames % sheet.players.length;
  return sheet.players[idx] ?? null;
}

export interface AddGameScreenProps {
  sheetId: string;
  /** Wenn gesetzt: Edit-Modus auf bestehendem Spiel. */
  gameId?: string;
}

export function AddGameScreen({ sheetId, gameId }: AddGameScreenProps) {
  const { t } = useTranslation();
  const state = useSheetStore((s) => s.state);
  const load = useSheetStore((s) => s.load);

  useEffect(() => {
    void load(sheetId);
  }, [load, sheetId]);

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text>{t('common.errorLoading')}: {state.error.message}</Text>
      </View>
    );
  }
  return <Loaded sheet={state.value} gameId={gameId} />;
}

function Loaded({ sheet, gameId }: { sheet: GameSheet; gameId?: string }) {
  const { t } = useTranslation();

  function buildLevelChipLabel(count: number): string {
    if (count === 1) return t('addGame.levelChip_one', { count });
    if (count === 2) return t('addGame.levelChip_two', { count });
    if (count === 3) return t('addGame.levelChip_three', { count });
    if (count === 4) return t('addGame.levelChip_four', { count });
    return t('addGame.levelChipBase');
  }

  function buildAnnouncementChipLabel(count: number, side: AnnouncementSide): string {
    const spec = announcementLabel(count, side);
    return t(spec.key, { count: spec.count });
  }

  const router = useRouter();
  const theme = useTheme();
  const addGame = useSheetStore((s) => s.addGame);
  const updateGame = useSheetStore((s) => s.updateGame);

  const settingsState = useSettingsStore((s) => s.state);
  const loadSettings = useSettingsStore((s) => s.load);
  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const existing = useMemo<Game | null>(() => {
    if (gameId === undefined) return null;
    for (const g of allGames(sheet)) {
      if (g.id === gameId) return g;
    }
    return null;
  }, [sheet, gameId]);

  const [sittingOut, setSittingOut] = useState<Player | null>(() => {
    if (existing !== null) {
      if (existing.sittingOutPlayerId === null) return null;
      return sheet.players.find((p) => p.id === existing.sittingOutPlayerId) ?? null;
    }
    return nextSittingOutOfSheet(sheet);
  });
  const [rePlayerIds, setRePlayerIds] = useState<Set<string>>(
    () => new Set(existing?.rePlayerIds ?? []),
  );
  const [winner, setWinner] = useState<WinnerSide>(existing?.winner ?? WinnerSide.re);
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(
    () => new Set(existing?.flagCodes ?? []),
  );
  const [triggersManualBock, setTriggersManualBock] = useState<boolean>(
    existing?.triggersManualBock ?? false,
  );

  const isSolo = rePlayerIds.size === 1;
  const activePlayers = sheet.players.filter((p) => p.id !== sittingOut?.id);
  const activeIds = new Set(activePlayers.map((p) => p.id));
  const canSubmit =
    (rePlayerIds.size === 1 || rePlayerIds.size === 2) &&
    [...rePlayerIds].every((id) => activeIds.has(id));

  const settings =
    settingsState.status === 'data' ? settingsState.value : appSettingsFallback;
  const mode = effectiveStackingMode(sheet, settings.defaultStackingMode);

  const { currentBockLevel } = useMemo(() => {
    const previewGame = createGame({
      rePlayerIds: isSolo ? ['re1'] : ['re1', 're2'],
      contraPlayerIds: isSolo ? ['c1', 'c2', 'c3'] : ['c1', 'c2'],
      winner,
      flagCodes: [...selectedFlags],
      isSolo,
      triggersManualBock,
    });
    const virtualSheet =
      existing === null
        ? sheetWithGame(sheet, previewGame)
        : replaceGame(sheet, {
            ...existing,
            flagCodes: [...selectedFlags],
            winner,
            isSolo,
            triggersManualBock,
          });
    const levels = resolveBock(virtualSheet, mode);
    const targetId = existing?.id ?? previewGame.id;
    return { currentBockLevel: levels.get(targetId) ?? BockLevel.none };
  }, [sheet, existing, isSolo, winner, selectedFlags, triggersManualBock, mode]);

  const preview = useMemo(() => {
    return scoreFor(
      createGame({
        rePlayerIds: isSolo ? ['re1'] : ['re1', 're2'],
        contraPlayerIds: isSolo ? ['c1', 'c2', 'c3'] : ['c1', 'c2'],
        winner,
        flagCodes: [...selectedFlags],
        isSolo,
      }),
      currentBockLevel,
    );
  }, [isSolo, winner, selectedFlags, currentBockLevel]);

  const counterCodes = useMemo(() => {
    return new Set<string>([
      ...fuchsSpec.reCodes,
      ...fuchsSpec.contraCodes,
      ...doppelkopfSpec.reCodes,
      ...doppelkopfSpec.contraCodes,
      ...levelCodes,
      ...reAnnouncementCodes,
      ...contraAnnouncementCodes,
    ]);
  }, []);

  function flagsByGroup(group: FlagGroup): ScoreFlag[] {
    return selectableFlags().filter((f) => f.group === group && !counterCodes.has(f.code));
  }

  function announcementCount(re: boolean): number {
    const codes = re ? reAnnouncementCodes : contraAnnouncementCodes;
    let count = 0;
    for (const c of codes) if (selectedFlags.has(c)) count++;
    return count;
  }

  function cycleAnnouncement(re: boolean) {
    const codes = re ? reAnnouncementCodes : contraAnnouncementCodes;
    const count = announcementCount(re);
    const next = count >= codes.length ? 0 : count + 1;
    setSelectedFlags((prev) => {
      const set = new Set(prev);
      for (const c of codes) set.delete(c);
      for (let i = 0; i < next; i++) set.add(codes[i]!);
      return set;
    });
  }

  function levelCount(): number {
    let count = 0;
    for (const c of levelCodes) if (selectedFlags.has(c)) count++;
    return count;
  }

  function cycleLevel() {
    const count = levelCount();
    const next = count >= levelCodes.length ? 0 : count + 1;
    setSelectedFlags((prev) => {
      const set = new Set(prev);
      for (const c of levelCodes) set.delete(c);
      for (let i = 0; i < next; i++) set.add(levelCodes[i]!);
      return set;
    });
  }

  function stackingCount(spec: StackingCounterSpec, re: boolean): number {
    const codes = re ? spec.reCodes : spec.contraCodes;
    let count = 0;
    for (const c of codes) if (selectedFlags.has(c)) count++;
    return count;
  }

  function cycleStacking(spec: StackingCounterSpec, re: boolean) {
    const codes = re ? spec.reCodes : spec.contraCodes;
    const count = stackingCount(spec, re);
    const otherCount = stackingCount(spec, !re);
    setSelectedFlags((prev) => {
      const set = new Set(prev);
      if (count < stepsPerSide(spec)) {
        if (otherCount + count + 1 <= spec.maxTotal) {
          set.add(codes[count]!);
        } else {
          for (const c of codes) set.delete(c);
        }
      } else {
        for (const c of codes) set.delete(c);
      }
      return set;
    });
  }

  function onFlagToggled(f: ScoreFlag, selected: boolean) {
    setSelectedFlags((prev) => {
      const set = new Set(prev);
      if (selected) {
        set.add(f.code);
        const implied = flagImplications.get(f.code);
        if (implied !== undefined) for (const c of implied) set.add(c);
        const counterpart = mutuallyExclusiveCounterparts.get(f.code);
        if (counterpart !== undefined) set.delete(counterpart);
      } else {
        set.delete(f.code);
        for (const [code, implied] of flagImplications) {
          if (implied.includes(f.code)) set.delete(code);
        }
      }
      return set;
    });
  }

  async function submit() {
    const reIds: string[] = [];
    const contraIds: string[] = [];
    for (const id of activeIds) {
      if (rePlayerIds.has(id)) reIds.push(id);
      else contraIds.push(id);
    }
    if (existing === null) {
      const game = createGame({
        rePlayerIds: reIds,
        contraPlayerIds: contraIds,
        winner,
        flagCodes: [...selectedFlags],
        sittingOutPlayerId: sittingOut?.id ?? null,
        isSolo,
        triggersManualBock,
      });
      await addGame(game);
    } else {
      const updated: Game = {
        ...existing,
        rePlayerIds: reIds,
        contraPlayerIds: contraIds,
        winner,
        flagCodes: [...selectedFlags],
        isSolo,
        triggersManualBock,
      };
      await updateGame(updated);
    }
    router.back();
  }

  function displayedValue(f: ScoreFlag): number {
    switch (f.target) {
      case FlagTarget.reSide:
        return winner === WinnerSide.re ? f.value : -f.value;
      case FlagTarget.contraSide:
        return winner === WinnerSide.contra ? f.value : -f.value;
      case FlagTarget.winner:
      case FlagTarget.loser:
        return f.value;
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
      {currentBockLevel !== BockLevel.none && (
        <Card mode="contained" style={{ backgroundColor: theme.colors.tertiaryContainer }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
            <Icon source="fire" size={20} color={theme.colors.onTertiaryContainer} />
            <Text
              style={{
                color: theme.colors.onTertiaryContainer,
                fontWeight: '600',
                flex: 1,
              }}
            >
              {currentBockLevel === BockLevel.double
                ? t('addGame.bockBannerDouble')
                : t('addGame.bockBannerSingle')}
            </Text>
          </View>
        </Card>
      )}

      <TeamPicker
        players={sheet.players}
        sittingOutPlayerId={sittingOut?.id ?? null}
        selectedRePlayerIds={rePlayerIds}
        onChanged={(next) => setRePlayerIds(next)}
        onSittingOutChanged={
          existing === null
            ? (p) => {
                setSittingOut(p);
                setRePlayerIds((prev) => {
                  const set = new Set(prev);
                  set.delete(p.id);
                  return set;
                });
              }
            : undefined
        }
      />

      <SegmentedButtons
        value={winner}
        onValueChange={(v) =>
          setWinner(v === WinnerSide.contra ? WinnerSide.contra : WinnerSide.re)
        }
        buttons={[
          { value: WinnerSide.re, label: isSolo ? t('addGame.winnerSoloRe') : t('addGame.winnerRe') },
          { value: WinnerSide.contra, label: t('addGame.winnerKontra') },
        ]}
      />

      <View style={{ alignSelf: 'flex-start' }}>
        <Chip selected={levelCount() > 0} showSelectedCheck={false} onPress={() => cycleLevel()}>
          {buildLevelChipLabel(levelCount())}
        </Chip>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
            {t('addGame.rePoints')}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Chip
              selected={announcementCount(true) > 0}
              showSelectedCheck={false}
              onPress={() => cycleAnnouncement(true)}
            >
              {buildAnnouncementChipLabel(announcementCount(true), 're')}
            </Chip>
          </View>
          <FlagGroupSection
            flags={flagsByGroup(FlagGroup.reParty)}
            selected={selectedFlags}
            onToggle={onFlagToggled}
            displayedValue={displayedValue}
            trailingChips={[
              <StackingCounterChip
                key="reFuchs"
                label={t(fuchsSpec.labelKey)}
                count={stackingCount(fuchsSpec, true)}
                sign={winner === WinnerSide.re ? 1 : -1}
                onTap={() => cycleStacking(fuchsSpec, true)}
              />,
              <StackingCounterChip
                key="reDoko"
                label={t(doppelkopfSpec.labelKey)}
                count={stackingCount(doppelkopfSpec, true)}
                sign={winner === WinnerSide.re ? 1 : -1}
                onTap={() => cycleStacking(doppelkopfSpec, true)}
              />,
            ]}
          />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
            {t('addGame.kontraPoints')}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Chip
              selected={announcementCount(false) > 0}
              showSelectedCheck={false}
              onPress={() => cycleAnnouncement(false)}
            >
              {buildAnnouncementChipLabel(announcementCount(false), 'contra')}
            </Chip>
          </View>
          <FlagGroupSection
            flags={flagsByGroup(FlagGroup.contraParty)}
            selected={selectedFlags}
            onToggle={onFlagToggled}
            displayedValue={displayedValue}
            trailingChips={[
              <StackingCounterChip
                key="contraFuchs"
                label={t(fuchsSpec.labelKey)}
                count={stackingCount(fuchsSpec, false)}
                sign={winner === WinnerSide.contra ? 1 : -1}
                onTap={() => cycleStacking(fuchsSpec, false)}
              />,
              <StackingCounterChip
                key="contraDoko"
                label={t(doppelkopfSpec.labelKey)}
                count={stackingCount(doppelkopfSpec, false)}
                sign={winner === WinnerSide.contra ? 1 : -1}
                onTap={() => cycleStacking(doppelkopfSpec, false)}
              />,
            ]}
          />
        </View>
      </View>

      <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <Icon
            source="calculator-variant-outline"
            size={20}
            color={theme.colors.onPrimaryContainer}
          />
          <Text
            style={{
              color: theme.colors.onPrimaryContainer,
              fontWeight: '600',
              flex: 1,
              fontVariant: ['tabular-nums'],
            }}
          >
            {previewText(t, preview, isSolo)}
          </Text>
        </View>
      </Card>

      <Card mode="contained">
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
              {t('addGame.manualBockTitle')}
            </Text>
            <Text variant="bodySmall">
              {t('addGame.manualBockHint')}
            </Text>
          </View>
          <Switch value={triggersManualBock} onValueChange={setTriggersManualBock} />
        </View>
      </Card>

      <Button mode="contained" icon="check" disabled={!canSubmit} onPress={() => void submit()}>
        {existing === null ? t('addGame.submitNew') : t('addGame.submitEdit')}
      </Button>
    </ScrollView>
  );
}

function previewText(
  t: (k: string, p?: Record<string, unknown>) => string,
  score: { rePerPlayer: number; contraPerPlayer: number },
  isSolo: boolean,
): string {
  const value = Math.abs(score.contraPerPlayer);
  const solistValue = Math.abs(score.rePerPlayer);
  return isSolo
    ? t('addGame.previewSoloValue', { value, solist: solistValue })
    : t('addGame.previewValue', { value });
}

interface FlagGroupSectionProps {
  flags: ReadonlyArray<ScoreFlag>;
  selected: ReadonlySet<string>;
  onToggle: (f: ScoreFlag, selected: boolean) => void;
  displayedValue: (f: ScoreFlag) => number;
  trailingChips?: ReadonlyArray<React.ReactNode>;
}

function FlagGroupSection({
  flags,
  selected,
  onToggle,
  displayedValue,
  trailingChips,
}: FlagGroupSectionProps) {
  function chipFor(f: ScoreFlag) {
    return (
      <FlagChip
        key={f.code}
        flag={f}
        selected={selected.has(f.code)}
        displayedValue={displayedValue(f)}
        enabled={!isFlagBlockedByConflict(f, selected)}
        onChanged={(sel) => onToggle(f, sel)}
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {flags.map((f) => chipFor(f))}
      {trailingChips}
    </View>
  );
}

interface StackingCounterChipProps {
  label: string;
  count: number;
  sign: 1 | -1;
  onTap: () => void;
}

function StackingCounterChip({ label, count, sign, onTap }: StackingCounterChipProps) {
  const value = count * sign;
  const formatted = value > 0 ? `+${value}` : String(value);
  const text = count === 0 ? label : `${label}  ${formatted}`;
  return (
    <Chip selected={count > 0} showSelectedCheck={false} onPress={onTap}>
      {text}
    </Chip>
  );
}
