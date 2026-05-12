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
}

export type GroupAction = SheetAction;

export interface GroupDecision {
  readonly imported: SheetGroup;
  readonly localExisting: SheetGroup | null;
  readonly suggested: GroupAction;
}

export type SettingsAction = 'replace' | 'keep';

export interface ImportPlan {
  readonly players: ReadonlyArray<PlayerDecision>;
  readonly groups: ReadonlyArray<GroupDecision>;
  readonly sheets: ReadonlyArray<SheetDecision>;
  readonly settings: { suggested: SettingsAction } | null;
}

export interface LocalState {
  readonly players: ReadonlyArray<Player>;
  readonly groups: ReadonlyArray<SheetGroup>;
  readonly sheets: ReadonlyArray<GameSheet>;
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

  const groups: GroupDecision[] = parsed.envelope.payload.groups.map((imp) => ({
    imported: imp,
    localExisting: localGroupsById.get(imp.id) ?? null,
    suggested: suggestForRecord(localGroupsById.get(imp.id) ?? null, imp.updatedAt),
  }));

  const sheets: SheetDecision[] = parsed.envelope.payload.sheets.map((imp) => {
    const blocked = imp.playerIds.some((id) => skippedPlayerIds.has(id));
    if (blocked) {
      return {
        imported: imp,
        localExisting: localSheetsById.get(imp.id) ?? null,
        suggested: { kind: 'skip' },
      };
    }
    return {
      imported: imp,
      localExisting: localSheetsById.get(imp.id) ?? null,
      suggested: suggestForRecord(localSheetsById.get(imp.id) ?? null, imp.updatedAt),
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
