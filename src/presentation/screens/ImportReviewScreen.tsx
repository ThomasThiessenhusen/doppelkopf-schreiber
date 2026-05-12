import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  HelperText,
  List,
  Menu,
  Text,
} from 'react-native-paper';

import { applyImportPlan } from '@/application/import/importApply';
import {
  buildImportPlan,
  type GroupAction,
  type ImportPlan,
  type LocalState,
  type PlayerAction,
  type PlayerDecision,
  type SettingsAction,
  type SheetAction,
} from '@/application/import/importDiff';
import {
  parseExportFile,
  ParseError,
  type ParsedExportFile,
} from '@/application/import/importParser';
import { repositories } from '@/application/stores/repositories';
import type { Player } from '@/domain/models/player';
import { useTranslation } from '@/presentation/i18n/useTranslation';

interface PreparedState {
  parsed: ParsedExportFile;
  initialPlan: ImportPlan;
  local: LocalState;
}

export interface ImportReviewScreenProps {
  fileUri: string;
}

type TFunc = (k: string, p?: Record<string, unknown>) => string;

export function ImportReviewScreen({ fileUri }: ImportReviewScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [playerActions, setPlayerActions] = useState<Record<string, PlayerAction>>({});
  const [sheetActions, setSheetActions] = useState<Record<string, SheetAction>>({});
  const [groupActions, setGroupActions] = useState<Record<string, GroupAction>>({});
  const [settingsAction, setSettingsAction] = useState<SettingsAction | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const text = await FileSystem.readAsStringAsync(fileUri);
        const parsed = parseExportFile(text);
        const local: LocalState = {
          players: await repositories.player().loadAll(),
          groups: await repositories.sheetGroup().loadAll(),
          sheets: await repositories.gameSheet().loadAll(),
          settings: await repositories.settings().load(),
        };
        const initialPlan = buildImportPlan(parsed, local);
        if (cancelled) return;
        setPrepared({ parsed, initialPlan, local });
        setPlayerActions(
          Object.fromEntries(initialPlan.players.map((d) => [d.imported.id, d.suggested])),
        );
        setSheetActions(
          Object.fromEntries(initialPlan.sheets.map((d) => [d.imported.id, d.suggested])),
        );
        setGroupActions(
          Object.fromEntries(initialPlan.groups.map((d) => [d.imported.id, d.suggested])),
        );
        setSettingsAction(initialPlan.settings?.suggested ?? null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ParseError ? e.message : `${e}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUri]);

  const recomputedPlan = useMemo<ImportPlan | null>(() => {
    if (prepared === null) return null;
    const re = buildImportPlan(prepared.parsed, prepared.local, {
      playerOverrides: playerActions,
    });
    return {
      ...prepared.initialPlan,
      sheets: prepared.initialPlan.sheets.map((d) => ({
        ...d,
        suggested:
          re.sheets.find((s) => s.imported.id === d.imported.id)?.suggested ?? d.suggested,
      })),
    };
  }, [prepared, playerActions]);

  if (error !== null) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text variant="titleMedium">{t('exportImport.importFailed')}</Text>
        <HelperText type="error" visible>
          {error}
        </HelperText>
        <Button mode="contained-tonal" onPress={() => router.back()}>
          {t('exportImport.cancelButton')}
        </Button>
      </View>
    );
  }

  if (prepared === null || recomputedPlan === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  async function onApply() {
    if (prepared === null) return;
    setApplying(true);
    const plan: ImportPlan = {
      players: prepared.initialPlan.players.map((d) => ({
        ...d,
        suggested: playerActions[d.imported.id] ?? d.suggested,
      })),
      groups: prepared.initialPlan.groups.map((d) => ({
        ...d,
        suggested: groupActions[d.imported.id] ?? d.suggested,
      })),
      sheets: (recomputedPlan?.sheets ?? prepared.initialPlan.sheets).map((d) => ({
        ...d,
        suggested: sheetActions[d.imported.id] ?? d.suggested,
      })),
      settings:
        prepared.initialPlan.settings === null
          ? null
          : { suggested: settingsAction ?? prepared.initialPlan.settings.suggested },
    };
    try {
      await applyImportPlan(plan, {
        settings: prepared.parsed.envelope.payload.settings ?? undefined,
      });
      router.replace('/');
    } catch (e) {
      setError(`${e}`);
    } finally {
      setApplying(false);
    }
  }

  const visiblePlayers = recomputedPlan.players.filter(
    (d) => d.suggested.kind !== 'useLocal',
  );
  const visibleGroups = recomputedPlan.groups.filter(
    (d) => d.suggested.kind !== 'useLocal',
  );
  const visibleSheets = recomputedPlan.sheets.filter(
    (d) => d.suggested.kind !== 'useLocal',
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 16, paddingBottom: 80 }}>
      {visiblePlayers.length > 0 && (
        <Card>
          <Card.Title title={t('exportImport.sectionPlayers')} />
          <Card.Content>
            {visiblePlayers.map((d, i) => (
              <View key={d.imported.id}>
                {i > 0 && <Divider />}
                <PlayerRow
                  decision={d}
                  action={playerActions[d.imported.id] ?? d.suggested}
                  localPool={prepared.local.players}
                  onChange={(a) =>
                    setPlayerActions((prev) => ({ ...prev, [d.imported.id]: a }))
                  }
                />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {visibleGroups.length > 0 && (
        <Card>
          <Card.Title title={t('exportImport.sectionGroups')} />
          <Card.Content>
            {visibleGroups.map((d, i) => (
              <View key={d.imported.id}>
                {i > 0 && <Divider />}
                <SheetOrGroupRow
                  title={d.imported.name}
                  subtitle={null}
                  action={groupActions[d.imported.id] ?? d.suggested}
                  isExisting={d.localExisting !== null}
                  onChange={(a) =>
                    setGroupActions((prev) => ({ ...prev, [d.imported.id]: a }))
                  }
                />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {visibleSheets.length > 0 && (
        <Card>
          <Card.Title title={t('exportImport.sectionSheets')} />
          <Card.Content>
            {visibleSheets.map((d, i) => (
              <View key={d.imported.id}>
                {i > 0 && <Divider />}
                <SheetOrGroupRow
                  title={d.imported.title ?? d.imported.id}
                  subtitle={d.imported.updatedAt.toLocaleString()}
                  action={sheetActions[d.imported.id] ?? d.suggested}
                  isExisting={d.localExisting !== null}
                  isBlocked={d.suggested.kind === 'skip' && d.localExisting === null}
                  onChange={(a) =>
                    setSheetActions((prev) => ({ ...prev, [d.imported.id]: a }))
                  }
                />
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {prepared.initialPlan.settings !== null && (
        <Card>
          <Card.Title title={t('exportImport.sectionSettings')} />
          <Card.Content>
            <Button
              mode={settingsAction === 'replace' ? 'contained' : 'outlined'}
              onPress={() => setSettingsAction('replace')}
              style={{ marginBottom: 8 }}
            >
              {t('exportImport.actionReplaceSettings')}
            </Button>
            <Button
              mode={settingsAction === 'keep' ? 'contained' : 'outlined'}
              onPress={() => setSettingsAction('keep')}
            >
              {t('exportImport.actionKeepSettings')}
            </Button>
          </Card.Content>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button mode="outlined" style={{ flex: 1 }} onPress={() => router.back()}>
          {t('exportImport.cancelButton')}
        </Button>
        <Button
          mode="contained"
          style={{ flex: 1 }}
          loading={applying}
          onPress={() => void onApply()}
        >
          {t('exportImport.applyButton')}
        </Button>
      </View>
    </ScrollView>
  );
}

function PlayerRow({
  decision,
  action,
  localPool,
  onChange,
}: {
  decision: PlayerDecision;
  action: PlayerAction;
  localPool: ReadonlyArray<Player>;
  onChange: (a: PlayerAction) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const label = describePlayerAction(action, localPool, t);
  return (
    <List.Item
      title={decision.imported.playerName}
      description={label}
      right={() => (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button onPress={() => setMenuOpen(true)} mode="text">
              {label}
            </Button>
          }
        >
          <Menu.Item
            title={t('exportImport.actionAddAsNew')}
            onPress={() => {
              onChange({ kind: 'addAsNew' });
              setMenuOpen(false);
            }}
          />
          {localPool.length > 0 && <Divider />}
          {localPool.map((p) => (
            <Menu.Item
              key={p.id}
              title={t('exportImport.actionMergeInto', { name: p.playerName })}
              onPress={() => {
                onChange({ kind: 'mergeInto', localId: p.id });
                setMenuOpen(false);
              }}
            />
          ))}
          <Divider />
          <Menu.Item
            title={t('exportImport.actionSkip')}
            onPress={() => {
              onChange({ kind: 'skip' });
              setMenuOpen(false);
            }}
          />
        </Menu>
      )}
    />
  );
}

function describePlayerAction(
  action: PlayerAction,
  localPool: ReadonlyArray<Player>,
  t: TFunc,
): string {
  switch (action.kind) {
    case 'addAsNew':
      return t('exportImport.actionAddAsNew');
    case 'mergeInto': {
      const target = localPool.find((p) => p.id === action.localId);
      return t('exportImport.actionMergeInto', {
        name: target?.playerName ?? action.localId,
      });
    }
    case 'useLocal':
      return t('exportImport.actionUseLocal');
    case 'skip':
      return t('exportImport.actionSkip');
  }
}

function SheetOrGroupRow({
  title,
  subtitle,
  action,
  isExisting,
  isBlocked,
  onChange,
}: {
  title: string;
  subtitle: string | null;
  action: SheetAction;
  isExisting: boolean;
  isBlocked?: boolean;
  onChange: (a: SheetAction) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (isBlocked === true) {
    return <List.Item title={title} description={t('exportImport.skipDependentSheet')} />;
  }
  return (
    <List.Item
      title={title}
      description={subtitle ?? undefined}
      right={() => (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Button onPress={() => setMenuOpen(true)} mode="text">
              {describeSheetAction(action, t)}
            </Button>
          }
        >
          {isExisting ? (
            <>
              <Menu.Item
                title={t('exportImport.actionReplaceLocal')}
                onPress={() => {
                  onChange({ kind: 'replaceLocal' });
                  setMenuOpen(false);
                }}
              />
              <Menu.Item
                title={t('exportImport.actionKeepLocal')}
                onPress={() => {
                  onChange({ kind: 'keepLocal' });
                  setMenuOpen(false);
                }}
              />
              <Menu.Item
                title={t('exportImport.actionAddCopy')}
                onPress={() => {
                  onChange({ kind: 'addCopy' });
                  setMenuOpen(false);
                }}
              />
            </>
          ) : (
            <>
              <Menu.Item
                title={t('exportImport.actionAddAsNew')}
                onPress={() => {
                  onChange({ kind: 'addAsNew' });
                  setMenuOpen(false);
                }}
              />
              <Menu.Item
                title={t('exportImport.actionAddCopy')}
                onPress={() => {
                  onChange({ kind: 'addCopy' });
                  setMenuOpen(false);
                }}
              />
            </>
          )}
          <Divider />
          <Menu.Item
            title={t('exportImport.actionSkip')}
            onPress={() => {
              onChange({ kind: 'skip' });
              setMenuOpen(false);
            }}
          />
        </Menu>
      )}
    />
  );
}

function describeSheetAction(action: SheetAction, t: TFunc): string {
  switch (action.kind) {
    case 'useLocal':
      return t('exportImport.actionUseLocal');
    case 'addAsNew':
      return t('exportImport.actionAddAsNew');
    case 'replaceLocal':
      return t('exportImport.actionReplaceLocal');
    case 'keepLocal':
      return t('exportImport.actionKeepLocal');
    case 'addCopy':
      return t('exportImport.actionAddCopy');
    case 'skip':
      return t('exportImport.actionSkip');
  }
}
