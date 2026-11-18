import { useNavigation, type NavigationAction } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Dialog,
  HelperText,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import {
  addRow,
  buildSheetFromGrid,
  computedColumnTotals,
  parseCellInput,
  removeRow,
  setCell,
  setRowSitter,
  validateGrid,
  type PaperCell,
  type PaperGrid,
  type PlayerAssignment,
} from '@/application/paper/paperGrid';
import { usePaperDraftStore } from '@/application/stores/paperDraftStore';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useSheetListStore } from '@/application/stores/sheetListStore';
import { formatDate, formatTime, parseDateTime } from '@/domain/dateTimeInput';
import { createPlayer, playerDisplayName, type Player } from '@/domain/models/player';
import type { RootStackParamList } from '@/navigation/types';
import { useTranslation } from '@/presentation/i18n/useTranslation';

const IDX_W = 28;
const ACT_W = 36;

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

function cellText(value: PaperCell): string {
  return value === null ? '' : String(value);
}

interface CellProps {
  value: PaperCell;
  highlighted: boolean;
  onValue: (value: PaperCell) => void;
  /** Meldet, ob der angezeigte Text ungueltig ist (blockiert dann das Speichern). */
  onInvalidChange: (invalid: boolean) => void;
}

/** Eine Raster-Zelle; Text bleibt waehrend der Eingabe lokal (z. B. "-" vor "-3"). */
function Cell({ value, highlighted, onValue, onInvalidChange }: CellProps) {
  const theme = useTheme();
  const [text, setText] = useState(cellText(value));
  const [invalid, setInvalid] = useState(false);
  const invalidCallback = useRef(onInvalidChange);
  invalidCallback.current = onInvalidChange;

  useEffect(() => {
    invalidCallback.current(invalid);
    // Beim Entfernen der Zelle (z. B. Zeile geloescht) die Meldung zuruecknehmen.
    return () => invalidCallback.current(false);
  }, [invalid]);

  useEffect(() => {
    // Von aussen geaenderte Werte (z. B. Aussetzer verschoben) uebernehmen.
    setText((prev) => {
      const parsed = parseCellInput(prev);
      return parsed === value ? prev : cellText(value);
    });
    setInvalid(false);
  }, [value]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 2 }}>
      <TextInput
        dense
        mode="outlined"
        value={text}
        placeholder="—"
        error={invalid}
        selectTextOnFocus
        keyboardType="numbers-and-punctuation"
        contentStyle={{ paddingHorizontal: 2 }}
        style={{
          textAlign: 'center',
          ...(highlighted ? { backgroundColor: theme.colors.tertiaryContainer } : {}),
        }}
        onChangeText={(next) => {
          setText(next);
          const parsed = parseCellInput(next);
          if (parsed === 'invalid') {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          onValue(parsed);
        }}
      />
    </View>
  );
}

/** Raster zum Erfassen eines Papier-Spielbogens; speichert ihn als Bogen aus Punkte-Spielen. */
export function PaperSheetGridScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const grid = usePaperDraftStore((s) => s.grid);
  const setGrid = usePaperDraftStore((s) => s.setGrid);

  const pool = usePlayerListStore((s) => s.players);
  const refreshPool = usePlayerListStore((s) => s.refresh);
  useEffect(() => {
    void refreshPool();
  }, [refreshPool]);

  useEffect(() => {
    // Ohne Entwurf (z. B. nach App-Neustart) zurueck zum Start.
    if (grid === null && !savedRef.current) navigation.replace('PaperSheetStart');
  }, [grid, navigation]);

  const [dateText, setDateText] = useState(() => (grid ? formatDate(grid.playedAt) : ''));
  const [timeText, setTimeText] = useState(() => (grid ? formatTime(grid.playedAt) : ''));
  const [dateInvalid, setDateInvalid] = useState(false);
  const [menuCol, setMenuCol] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Stabile Zeilenschluessel, damit Zelltexte beim Loeschen nicht mitwandern.
  const nextRowKey = useRef(grid?.rows.length ?? 0);
  const [rowKeys, setRowKeys] = useState<number[]>(() =>
    grid ? grid.rows.map((_, i) => i) : [],
  );
  const [invalidCells, setInvalidCells] = useState<ReadonlySet<string>>(new Set());
  const savedRef = useRef(false);
  const [leaveAction, setLeaveAction] = useState<NavigationAction | null>(null);

  useEffect(() => {
    // Zurueck/Schliessen mit Eingaben im Raster erst nach Rueckfrage.
    return navigation.addListener('beforeRemove', (e) => {
      const draft = usePaperDraftStore.getState().grid;
      if (savedRef.current || draft === null || draft.rows.length === 0) return;
      e.preventDefault();
      setLeaveAction(e.data.action);
    });
  }, [navigation]);

  const validation = useMemo(() => (grid ? validateGrid(grid, pool) : null), [grid, pool]);
  const totals = useMemo(() => (grid ? computedColumnTotals(grid) : []), [grid]);

  if (grid === null || validation === null) return null;
  const g: PaperGrid = grid;
  const v = validation;
  const colCount = g.columnNames.length;

  function update(next: PaperGrid) {
    setGrid(next);
  }

  function updateDate(nextDate: string, nextTime: string) {
    setDateText(nextDate);
    setTimeText(nextTime);
    const parsed = parseDateTime(nextDate, nextTime);
    setDateInvalid(parsed === null);
    if (parsed !== null) update({ ...g, playedAt: parsed });
  }

  function addGridRow() {
    setRowKeys((keys) => [...keys, nextRowKey.current++]);
    update(addRow(g));
  }

  function removeGridRow(row: number) {
    setRowKeys((keys) => keys.filter((_, i) => i !== row));
    update(removeRow(g, row));
  }

  function setInvalid(key: string, invalid: boolean) {
    setInvalidCells((prev) => {
      if (prev.has(key) === invalid) return prev;
      const next = new Set(prev);
      if (invalid) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function discardAndLeave() {
    const action = leaveAction;
    setLeaveAction(null);
    savedRef.current = true;
    usePaperDraftStore.getState().reset();
    if (action !== null) navigation.dispatch(action);
  }

  function assign(col: number, a: PlayerAssignment) {
    update({ ...g, assignments: g.assignments.map((x, i) => (i === col ? a : x)) });
  }

  function assignmentLabel(a: PlayerAssignment): string {
    if (a.kind === 'pool') {
      const p = pool.find((x) => x.id === a.playerId);
      return p ? playerDisplayName(p) : t('paperImport.assignPick');
    }
    if (a.kind === 'new') return t('paperImport.assignedNew', { name: a.name });
    return t('paperImport.assignPick');
  }

  async function confirm() {
    setSaveError(null);
    setSaving(true);
    try {
      const players: Player[] = g.assignments.map((a, col) => {
        if (a.kind === 'pool') {
          const found = pool.find((p) => p.id === a.playerId);
          if (found === undefined) throw new Error(`Spieler fehlt: ${a.playerId}`);
          return found;
        }
        if (a.kind === 'new') return createPlayer({ playerName: a.name.trim() });
        throw new Error(`Spalte ${col + 1} ist nicht zugeordnet.`);
      });
      const sheet = buildSheetFromGrid(g, players);
      await useSheetListStore.getState().createSheet(sheet, players);
      await usePlayerListStore.getState().refresh();
      savedRef.current = true;
      usePaperDraftStore.getState().reset();
      navigation.reset({
        index: 1,
        routes: [{ name: 'Home' }, { name: 'Sheet', params: { sheetId: sheet.id } }],
      });
    } catch (e) {
      console.error(e);
      setSaveError(t('paperImport.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const rowIssueByRow = new Map<number, string[]>();
  for (const issue of v.rowIssues) {
    const list = rowIssueByRow.get(issue.row) ?? [];
    if (issue.kind === 'empty') list.push(t('paperImport.rowEmpty'));
    if (issue.kind === 'sitter') list.push(t('paperImport.rowSitter'));
    rowIssueByRow.set(issue.row, list);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <TextInput
        mode="outlined"
        label={t('paperImport.titleLabel')}
        value={g.title}
        onChangeText={(title) => update({ ...g, title })}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          mode="outlined"
          style={{ flex: 1 }}
          label={t('sheet.playedAtDateLabel')}
          value={dateText}
          error={dateInvalid}
          onChangeText={(text) => updateDate(text, timeText)}
        />
        <TextInput
          mode="outlined"
          style={{ flex: 1 }}
          label={t('sheet.playedAtTimeLabel')}
          value={timeText}
          error={dateInvalid}
          onChangeText={(text) => updateDate(dateText, text)}
        />
      </View>
      {dateInvalid && <HelperText type="error">{t('sheet.playedAtInvalid')}</HelperText>}

      <View>
        {/* Kopf: Name auf dem Papier und Zuordnung je Spalte */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: IDX_W }} />
          {g.columnNames.map((name, col) => {
            const a = g.assignments[col]!;
            const problem = v.assignmentIssues.some((x) => x.col === col);
            const color = problem ? theme.colors.error : theme.colors.primary;
            return (
              <View key={col} style={{ flex: 1, paddingHorizontal: 2, gap: 4 }}>
                <TextInput
                  dense
                  mode="outlined"
                  label={t('paperImport.columnNameLabel')}
                  value={name}
                  contentStyle={{ paddingHorizontal: 4 }}
                  style={{ textAlign: 'center' }}
                  onChangeText={(text) => {
                    const columnNames = g.columnNames.map((n, i) => (i === col ? text : n));
                    // Neu-anlegen folgt dem Namen, solange es gewaehlt ist.
                    const assignments = g.assignments.map((x, i) =>
                      i === col && x.kind === 'new' ? { kind: 'new' as const, name: text } : x,
                    );
                    update({ ...g, columnNames, assignments });
                  }}
                />
                <Menu
                  visible={menuCol === col}
                  onDismiss={() => setMenuCol(null)}
                  anchor={
                    <TouchableRipple
                      onPress={() => setMenuCol(col)}
                      style={{
                        borderWidth: 1,
                        borderRadius: 18,
                        borderColor: problem ? theme.colors.error : theme.colors.outline,
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text numberOfLines={1} style={{ fontSize: 12, textAlign: 'center', color }}>
                        {assignmentLabel(a)}
                      </Text>
                    </TouchableRipple>
                  }
                >
                  {pool.map((p) => (
                    <Menu.Item
                      key={p.id}
                      title={playerDisplayName(p)}
                      onPress={() => {
                        setMenuCol(null);
                        assign(col, { kind: 'pool', playerId: p.id });
                      }}
                    />
                  ))}
                  {name.trim() !== '' && (
                    <Menu.Item
                      title={t('paperImport.assignNew', { name: name.trim() })}
                      onPress={() => {
                        setMenuCol(null);
                        assign(col, { kind: 'new', name: name.trim() });
                      }}
                    />
                  )}
                </Menu>
              </View>
            );
          })}
          <View style={{ width: ACT_W }} />
        </View>

        {/* Zuordnungs-Hinweise als einzelne Zeilen statt je Spalte */}
        {v.assignmentIssues.some((x) => x.kind === 'unassigned') && (
          <HelperText type="error" style={{ paddingHorizontal: 0 }}>
            {t('paperImport.assignUnassigned')}
          </HelperText>
        )}
        {v.assignmentIssues.some((x) => x.kind === 'duplicate') && (
          <HelperText type="error" style={{ paddingHorizontal: 0 }}>
            {t('paperImport.assignDuplicate')}
          </HelperText>
        )}
        {v.similarNameWarnings.map((w) => {
          const similarPlayer = pool.find((p) => p.id === w.poolPlayerId);
          if (similarPlayer === undefined) return null;
          return (
            <HelperText key={w.col} type="info" style={{ paddingHorizontal: 0 }}>
              {t('paperImport.assignSimilar', {
                column: g.columnNames[w.col] ?? '',
                name: playerDisplayName(similarPlayer),
              })}
            </HelperText>
          );
        })}

        {/* Spiele */}
        {g.rows.map((cells, row) => {
          const sum = cells.reduce<number>((acc, c) => acc + (c ?? 0), 0);
          const issues = rowIssueByRow.get(row) ?? [];
          const sumBad = v.rowIssues.some((x) => x.row === row && x.kind === 'sum');
          return (
            <View key={rowKeys[row] ?? row} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: IDX_W, textAlign: 'right', paddingRight: 6 }}>{row + 1}</Text>
                {cells.map((cell, col) => (
                  <Cell
                    key={col}
                    value={cell}
                    highlighted={g.uncertain.some((u) => u.game === row && u.player === col)}
                    onValue={(value) => update(setCell(g, row, col, value))}
                    onInvalidChange={(inv) => setInvalid(`${rowKeys[row] ?? row}:${col}`, inv)}
                  />
                ))}
                <IconButton
                  icon="delete-outline"
                  size={18}
                  accessibilityLabel={t('paperImport.removeRow')}
                  onPress={() => removeGridRow(row)}
                  style={{ width: ACT_W, margin: 0 }}
                />
              </View>
              {colCount === 5 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: IDX_W }} />
                  {cells.map((cell, col) => (
                    <View key={col} style={{ flex: 1, alignItems: 'center' }}>
                      <IconButton
                        icon="account-off-outline"
                        size={14}
                        accessibilityLabel={t('paperImport.sitterButton')}
                        selected={cell === null}
                        onPress={() => update(setRowSitter(g, row, col))}
                        style={{ margin: 0, width: 24, height: 24 }}
                      />
                    </View>
                  ))}
                  <View style={{ width: ACT_W }} />
                </View>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: IDX_W,
                  paddingLeft: 2,
                }}
              >
                <Icon
                  source={sumBad ? 'alert-outline' : 'check-circle-outline'}
                  size={14}
                  color={sumBad ? theme.colors.error : theme.colors.primary}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: sumBad ? theme.colors.error : theme.colors.onSurfaceVariant }}
                >
                  {t('paperImport.rowSum', { sum })}
                </Text>
              </View>
              {issues.map((text) => (
                <HelperText key={text} type="error" style={{ marginLeft: IDX_W, paddingLeft: 2 }}>
                  {text}
                </HelperText>
              ))}
            </View>
          );
        })}

        {/* Berechnete Summen */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Text variant="titleMedium" style={{ width: IDX_W, textAlign: 'right', paddingRight: 6 }}>
            Σ
          </Text>
          {totals.map((total, col) => (
            <Text
              key={col}
              variant="titleMedium"
              style={{
                flex: 1,
                textAlign: 'center',
                fontWeight: 'bold',
                fontVariant: ['tabular-nums'],
                color:
                  total > 0 ? theme.colors.primary : total < 0 ? theme.colors.error : undefined,
              }}
            >
              {formatPoints(total)}
            </Text>
          ))}
          <View style={{ width: ACT_W }} />
        </View>
      </View>

      {v.paperTotalsMismatch && (
        <HelperText type="info" style={{ paddingHorizontal: 0 }}>
          {t('paperImport.paperTotalsHint')}
        </HelperText>
      )}

      <Button icon="plus" mode="outlined" onPress={addGridRow}>
        {t('paperImport.addRow')}
      </Button>

      {g.rows.length === 0 && <HelperText type="info">{t('paperImport.needRows')}</HelperText>}
      {saveError !== null && <HelperText type="error">{saveError}</HelperText>}
      <Button
        mode="contained"
        disabled={!v.canConfirm || saving || dateInvalid || invalidCells.size > 0}
        loading={saving}
        onPress={() => void confirm()}
      >
        {t('paperImport.createSheet')}
      </Button>
      {invalidCells.size > 0 && (
        <HelperText type="error">{t('paperImport.invalidCells')}</HelperText>
      )}

      <Portal>
        <Dialog visible={leaveAction !== null} onDismiss={() => setLeaveAction(null)}>
          <Dialog.Title>{t('paperImport.leaveTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('paperImport.leaveBody')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLeaveAction(null)}>{t('paperImport.leaveStay')}</Button>
            <Button mode="contained-tonal" onPress={discardAndLeave}>
              {t('paperImport.leaveDiscard')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}
