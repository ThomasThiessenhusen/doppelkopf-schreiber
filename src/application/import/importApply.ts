import { newId } from '@/core/id';
import type { AppSettings } from '@/domain/models/appSettings';
import type { GameSheet } from '@/domain/models/gameSheet';
import { copyGameSheet } from '@/domain/models/gameSheet';
import { copySheetGroup, type SheetGroup } from '@/domain/models/sheetGroup';
import { repositories } from '@/application/stores/repositories';
import type { ImportPlan } from '@/application/import/importDiff';

export interface ImportResult {
  readonly playersAdded: number;
  readonly playersMerged: number;
  readonly groupsAdded: number;
  readonly groupsReplaced: number;
  readonly groupsCopied: number;
  readonly sheetsAdded: number;
  readonly sheetsReplaced: number;
  readonly sheetsCopied: number;
  readonly sheetsSkipped: number;
  readonly settingsReplaced: boolean;
}

export interface ApplyOptions {
  /**
   * Bei `plan.settings !== null` muessen die importierten Settings hier
   * mitgegeben werden — die landen sonst nicht im Plan, weil der `Plan`
   * sie nicht traegt. UI ruft das so auf, da sie den Envelope ohnehin
   * in der Hand hat.
   */
  readonly settings?: AppSettings;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export async function applyImportPlan(
  plan: ImportPlan,
  options: ApplyOptions = {},
): Promise<ImportResult> {
  const counters: Mutable<ImportResult> = {
    playersAdded: 0,
    playersMerged: 0,
    groupsAdded: 0,
    groupsReplaced: 0,
    groupsCopied: 0,
    sheetsAdded: 0,
    sheetsReplaced: 0,
    sheetsCopied: 0,
    sheetsSkipped: 0,
    settingsReplaced: false,
  };

  // 1) Players
  const playerRemap = new Map<string, string>();
  for (const d of plan.players) {
    const action = d.suggested;
    switch (action.kind) {
      case 'useLocal':
        playerRemap.set(d.imported.id, action.localId);
        break;
      case 'mergeInto':
        playerRemap.set(d.imported.id, action.localId);
        counters.playersMerged += 1;
        break;
      case 'addAsNew':
        await repositories.player().save(d.imported);
        playerRemap.set(d.imported.id, d.imported.id);
        counters.playersAdded += 1;
        break;
      case 'skip':
        break;
    }
  }

  // 2) Settings
  if (plan.settings !== null && options.settings !== undefined) {
    if (plan.settings.suggested === 'replace') {
      await repositories.settings().save(options.settings);
      counters.settingsReplaced = true;
    }
  }

  // 3) Groups
  const groupRemap = new Map<string, string>();
  for (const d of plan.groups) {
    const action = d.suggested;
    switch (action.kind) {
      case 'useLocal':
        groupRemap.set(d.imported.id, d.imported.id);
        break;
      case 'addAsNew':
        await repositories.sheetGroup().save(d.imported);
        groupRemap.set(d.imported.id, d.imported.id);
        counters.groupsAdded += 1;
        break;
      case 'replaceLocal':
        await repositories.sheetGroup().save(d.imported);
        groupRemap.set(d.imported.id, d.imported.id);
        counters.groupsReplaced += 1;
        break;
      case 'keepLocal':
        groupRemap.set(d.imported.id, d.imported.id);
        break;
      case 'addCopy': {
        const fresh = copyGroupWithNewId(d.imported);
        await repositories.sheetGroup().save(fresh);
        groupRemap.set(d.imported.id, fresh.id);
        counters.groupsCopied += 1;
        break;
      }
      case 'skip':
        break;
    }
  }

  // 4) Sheets
  for (const d of plan.sheets) {
    const action = d.suggested;
    if (action.kind === 'skip' || action.kind === 'keepLocal' || action.kind === 'useLocal') {
      if (action.kind === 'skip') counters.sheetsSkipped += 1;
      continue;
    }
    const remappedPlayerIds = d.imported.playerIds.map((id) => playerRemap.get(id) ?? id);
    const remappedGroupId =
      d.imported.groupId === null ? null : (groupRemap.get(d.imported.groupId) ?? null);
    switch (action.kind) {
      case 'addAsNew':
      case 'replaceLocal': {
        const next = copyGameSheet(d.imported, {
          playerIds: remappedPlayerIds,
          groupId: remappedGroupId,
          updatedAt: d.imported.updatedAt,
          dirty: false,
        });
        await repositories.gameSheet().save(next);
        if (action.kind === 'addAsNew') counters.sheetsAdded += 1;
        else counters.sheetsReplaced += 1;
        break;
      }
      case 'addCopy': {
        const persisted: GameSheet = {
          ...d.imported,
          id: newId(),
          playerIds: remappedPlayerIds,
          groupId: remappedGroupId,
        };
        await repositories.gameSheet().save(persisted);
        counters.sheetsCopied += 1;
        break;
      }
    }
  }

  return counters;
}

function copyGroupWithNewId(g: SheetGroup): SheetGroup {
  return copySheetGroup({ ...g, id: newId() }, { updatedAt: g.updatedAt, dirty: g.dirty });
}
