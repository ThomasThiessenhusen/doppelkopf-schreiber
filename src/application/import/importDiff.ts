import type { AppSettings } from '@/domain/models/appSettings';
import { playerDisplayName, type Player } from '@/domain/models/player';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { SheetGroup } from '@/domain/models/sheetGroup';
import type { ParsedExportFile } from '@/application/import/importParser';

export type PlayerAction =
  | { kind: 'useLocal'; localId: string }
  | { kind: 'mergeInto'; localId: string }
  | { kind: 'addAsNew' }
  | { kind: 'skip' };

export interface PlayerDecision {
  readonly imported: Player;
  readonly suggested: PlayerAction;
  readonly localMatchById: string | null;
  readonly localMatchByName: string | null;
}

export type SheetAction =
  | { kind: 'useLocal' }
  | { kind: 'addAsNew' }
  | { kind: 'replaceLocal' }
  | { kind: 'keepLocal' }
  | { kind: 'addCopy' }
  | { kind: 'skip' };

export interface SheetDecision {
  readonly imported: GameSheet;
  readonly localExisting: GameSheet | null;
  readonly suggested: SheetAction;
  /**
   * Lokaler Bogen mit anderer ID, aber gleicher Gruppe, gleichem Spieltag und
   * gleichen Spielern — vermutlich derselbe Spieltag, doppelt erfasst. Nur ein
   * Hinweis, die vorgeschlagene Aktion bleibt unveraendert.
   */
  readonly possibleDuplicateOf: GameSheet | null;
}

export type GroupAction = SheetAction | { kind: 'mergeInto'; localId: string };

export interface GroupDecision {
  readonly imported: SheetGroup;
  readonly localExisting: SheetGroup | null;
  /** Lokale Gruppe mit anderer ID, aber gleichem Namen (nur wenn keine ID-Uebereinstimmung). */
  readonly localMatchByName: SheetGroup | null;
  readonly suggested: GroupAction;
}

export type SettingsAction = 'replace' | 'keep';

export interface ImportPlan {
  readonly players: readonly PlayerDecision[];
  readonly groups: readonly GroupDecision[];
  readonly sheets: readonly SheetDecision[];
  readonly settings: { suggested: SettingsAction } | null;
}

export interface LocalState {
  readonly players: readonly Player[];
  readonly groups: readonly SheetGroup[];
  readonly sheets: readonly GameSheet[];
  readonly settings: AppSettings;
}

export interface BuildPlanOptions {
  readonly playerOverrides?: Record<string, PlayerAction>;
}

/**
 * Berechnet pro Entitaet eine vorgeschlagene Aktion. Pure Funktion.
 * `playerOverrides` erlaubt es, eine bereits getroffene Nutzer-Entscheidung
 * (z.B. `skip`) durchzureichen, damit der Sheets-Cascade beruecksichtigt
 * wird, ohne dass die UI alles neu durchrechnen muss.
 */
export function buildImportPlan(
  parsed: ParsedExportFile,
  local: LocalState,
  options: BuildPlanOptions = {},
): ImportPlan {
  const localPlayersById = new Map(local.players.map((p) => [p.id, p] as const));
  const localPlayersByName = new Map(
    local.players.map((p) => [playerDisplayName(p).toLowerCase(), p] as const),
  );
  const localSheetsById = new Map(local.sheets.map((s) => [s.id, s] as const));
  const localGroupsById = new Map(local.groups.map((g) => [g.id, g] as const));

  const players: PlayerDecision[] = parsed.envelope.payload.players.map((imp) => {
    const byId = localPlayersById.get(imp.id) ?? null;
    const byName = localPlayersByName.get(playerDisplayName(imp).toLowerCase()) ?? null;
    const override = options.playerOverrides?.[imp.id];
    const suggested: PlayerAction =
      override ??
      (byId !== null
        ? { kind: 'useLocal', localId: byId.id }
        : byName !== null
          ? { kind: 'mergeInto', localId: byName.id }
          : { kind: 'addAsNew' });
    return {
      imported: imp,
      suggested,
      localMatchById: byId?.id ?? null,
      localMatchByName: byName?.id ?? null,
    };
  });

  const skippedPlayerIds = new Set(
    players.filter((d) => d.suggested.kind === 'skip').map((d) => d.imported.id),
  );

  const localGroupsByName = new Map<string, SheetGroup>();
  for (const lg of local.groups) {
    const key = groupNameKey(lg.name);
    if (!localGroupsByName.has(key)) localGroupsByName.set(key, lg);
  }

  const groups: GroupDecision[] = parsed.envelope.payload.groups.map((imp) => {
    const byId = localGroupsById.get(imp.id) ?? null;
    const byName = byId === null ? (localGroupsByName.get(groupNameKey(imp.name)) ?? null) : null;
    return {
      imported: imp,
      localExisting: byId,
      localMatchByName: byName,
      suggested:
        byName !== null
          ? { kind: 'mergeInto', localId: byName.id }
          : suggestForRecord(byId, imp.updatedAt),
    };
  });

  // Importierte Gruppen-/Spieler-ID -> lokale ID, fuer den Duplikat-Vergleich.
  const playerIdMap = new Map<string, string>();
  for (const d of players) {
    if (d.suggested.kind === 'useLocal' || d.suggested.kind === 'mergeInto') {
      playerIdMap.set(d.imported.id, d.suggested.localId);
    }
  }
  const groupIdMap = new Map<string, string>();
  for (const d of groups) {
    if (d.suggested.kind === 'mergeInto') groupIdMap.set(d.imported.id, d.suggested.localId);
  }

  const sheets: SheetDecision[] = parsed.envelope.payload.sheets.map((imp) => {
    const localExisting = localSheetsById.get(imp.id) ?? null;
    const blocked = imp.playerIds.some((id) => skippedPlayerIds.has(id));
    if (blocked) {
      return {
        imported: imp,
        localExisting,
        suggested: { kind: 'skip' },
        possibleDuplicateOf: null,
      };
    }
    return {
      imported: imp,
      localExisting,
      suggested: suggestForRecord(localExisting, imp.updatedAt),
      possibleDuplicateOf:
        localExisting === null
          ? findPossibleDuplicate(imp, local.sheets, playerIdMap, groupIdMap)
          : null,
    };
  });

  const importedSettings = parsed.envelope.payload.settings;
  const settings =
    importedSettings === null
      ? null
      : {
          suggested: settingsEqual(importedSettings, local.settings)
            ? ('keep' as const)
            : ('replace' as const),
        };

  return { players, groups, sheets, settings };
}

function groupNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function playerSetKey(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join('|');
}

function findPossibleDuplicate(
  imported: GameSheet,
  localSheets: readonly GameSheet[],
  playerIdMap: ReadonlyMap<string, string>,
  groupIdMap: ReadonlyMap<string, string>,
): GameSheet | null {
  const groupId =
    imported.groupId === null ? null : (groupIdMap.get(imported.groupId) ?? imported.groupId);
  const players = playerSetKey(imported.playerIds.map((id) => playerIdMap.get(id) ?? id));
  const day = dayKey(imported.playedAt);
  return (
    localSheets.find(
      (l) =>
        l.id !== imported.id &&
        l.groupId === groupId &&
        dayKey(l.playedAt) === day &&
        playerSetKey(l.playerIds) === players,
    ) ?? null
  );
}

function suggestForRecord(
  existing: { updatedAt: Date } | null,
  importedUpdatedAt: Date,
): SheetAction {
  if (existing === null) return { kind: 'addAsNew' };
  if (existing.updatedAt.getTime() === importedUpdatedAt.getTime()) {
    return { kind: 'useLocal' };
  }
  return importedUpdatedAt > existing.updatedAt
    ? { kind: 'replaceLocal' }
    : { kind: 'keepLocal' };
}

function settingsEqual(a: AppSettings, b: AppSettings): boolean {
  return a.defaultStackingMode === b.defaultStackingMode && a.language === b.language;
}
