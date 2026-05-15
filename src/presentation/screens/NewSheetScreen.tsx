import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/types';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  RadioButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { createGameSheet } from '@/domain/models/gameSheet';
import { playerDisplayName, type Player } from '@/domain/models/player';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { GroupType, groupTypeLabelKey } from '@/domain/models/groupType';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useSettingsStore } from '@/application/stores/settingsStore';
import { useSheetGroupListStore } from '@/application/stores/sheetGroupListStore';
import { useSheetListStore } from '@/application/stores/sheetListStore';
import { useTranslation } from '@/presentation/i18n/useTranslation';

export interface NewSheetScreenProps {
  /** Wenn gesetzt, wird die Gruppe vorausgewaehlt (z. B. aus Home-Filter). */
  initialGroupId?: string | null;
}

export function NewSheetScreen({ initialGroupId = null }: NewSheetScreenProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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

  const groups = useSheetGroupListStore((s) => s.groups);
  const refreshGroups = useSheetGroupListStore((s) => s.refresh);
  const createGroup = useSheetGroupListStore((s) => s.create);
  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  const [groupId, setGroupId] = useState<string | null>(initialGroupId);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupNewOpen, setGroupNewOpen] = useState(false);
  const [groupNewName, setGroupNewName] = useState('');
  const [groupNewType, setGroupNewType] = useState<GroupType>(GroupType.season);

  useEffect(() => {
    if (groupId !== null && groups.length > 0 && !groups.some((g) => g.id === groupId)) {
      setGroupId(null);
    }
  }, [groupId, groups]);

  const selectedGroup =
    groupId === null ? null : groups.find((g) => g.id === groupId) ?? null;

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
    setGroupId(created.id);
  }
  function pickExistingGroup(g: SheetGroup | null) {
    setGroupPickerOpen(false);
    setGroupId(g?.id ?? null);
  }

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
        groupId,
      }),
      stackingModeOverride: selectedMode,
    };
    await createSheet(sheet, selected);
    navigation.replace('Sheet', { sheetId: sheet.id });
  }

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  return (
    <>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <TextInput
        label={t('newSheet.titleLabel')}
        placeholder={t('newSheet.titlePlaceholder')}
        mode="outlined"
        value={title}
        onChangeText={setTitle}
      />

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">{t('newSheet.groupSection')}</Text>
        <Button
          mode="outlined"
          icon={selectedGroup === null ? 'folder-outline' : 'folder'}
          onPress={() => setGroupPickerOpen(true)}
        >
          {selectedGroup === null
            ? t('newSheet.groupNone')
            : t('newSheet.groupSummary', { name: selectedGroup.name, type: t(groupTypeLabelKey(selectedGroup.type)) })}
        </Button>
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">{t('newSheet.playerCountSection')}</Text>
        <SegmentedButtons
          value={String(playerCount)}
          onValueChange={(v) => onPlayerCountChanged(v === '5' ? 5 : 4)}
          buttons={[
            { value: '4', label: t('newSheet.playerCount4') },
            { value: '5', label: t('newSheet.playerCount5') },
          ]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="titleMedium">{t('newSheet.stackingSection')}</Text>
        <Text variant="bodySmall">
          {t('newSheet.stackingHint')}
        </Text>
        <SegmentedButtons
          value={selectedMode}
          onValueChange={(v) => setStackingOverride(v as BockStackingMode)}
          buttons={[
            { value: BockStackingMode.sequential, label: t('newSheet.stackingSequential') },
            { value: BockStackingMode.doppelbock, label: t('newSheet.stackingDoppelbock') },
          ]}
        />
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="titleMedium" style={{ flex: 1 }}>
            {t('newSheet.pickPlayers')}
          </Text>
          <Text variant="bodySmall">
            {t('newSheet.pickCount', { selected: selected.length, total: playerCount })}
          </Text>
        </View>

        {playersLoading && players.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator />
          </View>
        ) : players.length === 0 ? (
          <Card>
            <Card.Content style={{ gap: 8 }}>
              <Text variant="titleSmall">{t('newSheet.noPlayersTitle')}</Text>
              <Text variant="bodySmall">
                {t('newSheet.noPlayersHint')}
              </Text>
              <Button mode="contained-tonal" onPress={() => navigation.navigate('Players')}>
                {t('newSheet.openPlayerMgmt')}
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
          <Text variant="titleMedium">{t('newSheet.orderSection')}</Text>
          <Text variant="bodySmall">
            {t('newSheet.orderHint')}
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
                      <Text variant="bodySmall">{t('newSheet.firstDealer')}</Text>
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
        {t('newSheet.create')}
      </Button>
    </ScrollView>
    <Portal>
      <Dialog visible={groupPickerOpen} onDismiss={() => setGroupPickerOpen(false)}>
        <Dialog.Title>{t('newSheet.groupPickerTitle')}</Dialog.Title>
        <Dialog.Content>
          <RadioButton.Group
            value={groupId ?? '__none__'}
            onValueChange={(v) => {
              if (v === '__none__') {
                pickExistingGroup(null);
              } else if (v === '__new__') {
                startCreateGroup();
              } else {
                const g = groups.find((x) => x.id === v);
                pickExistingGroup(g ?? null);
              }
            }}
          >
            <RadioButton.Item label={t('newSheet.groupNone')} value="__none__" />
            {groups.map((g) => (
              <RadioButton.Item
                key={g.id}
                label={t('newSheet.groupOptionWithType', { name: g.name, type: t(groupTypeLabelKey(g.type)) })}
                value={g.id}
              />
            ))}
            <RadioButton.Item label={t('newSheet.groupOptionNew')} value="__new__" />
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setGroupPickerOpen(false)}>{t('common.close')}</Button>
        </Dialog.Actions>
      </Dialog>

      <Dialog visible={groupNewOpen} onDismiss={() => setGroupNewOpen(false)}>
        <Dialog.Title>{t('newSheet.groupNewTitle')}</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label={t('newSheet.groupNewName')}
            value={groupNewName}
            onChangeText={setGroupNewName}
            autoFocus
          />
          <View style={{ marginTop: 12 }}>
            <SegmentedButtons
              value={groupNewType}
              onValueChange={(v) => setGroupNewType(v as GroupType)}
              buttons={[
                { value: GroupType.season, label: t('newSheet.groupTypeSeason') },
                { value: GroupType.tournament, label: t('newSheet.groupTypeTournament') },
              ]}
            />
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setGroupNewOpen(false)}>{t('common.cancel')}</Button>
          <Button mode="contained" onPress={() => void submitCreateGroup()}>
            {t('newSheet.groupCreate')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </>
  );
}
