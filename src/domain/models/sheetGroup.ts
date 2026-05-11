import {
  GroupType,
  groupTypeFromJson,
  groupTypeToJson,
} from '@/domain/models/groupType';

/**
 * Gruppierung mehrerer Spielbogen zu einer Saison oder einem Turnier.
 *
 * Mitgliedschaft wird ueber `GameSheet.groupId` ausgedrueckt — eine Gruppe
 * speichert selbst keine Spielbogen-IDs. So entstehen keine Konsistenz-
 * Probleme beim Loeschen einzelner Boegen.
 */
export interface SheetGroup {
  readonly id: string;
  readonly name: string;
  readonly type: GroupType;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Sync-Marker fuer eine spaetere Cloud-Anbindung (analog zu `GameSheet`). */
  readonly dirty: boolean;
}

export interface SheetGroupPatch {
  name?: string;
  type?: GroupType;
  /** Auslassen = `new Date()` (jetzt). */
  updatedAt?: Date;
  /** Auslassen = `true` (gepatchte Gruppe ist dirty). */
  dirty?: boolean;
}

/**
 * Aktualisiert ausgewaehlte Felder. `updatedAt` wird automatisch auf `new Date()`
 * gesetzt, falls nicht uebergeben; `dirty` defaultet auf `true`.
 */
export function copySheetGroup(g: SheetGroup, patch: SheetGroupPatch): SheetGroup {
  return {
    id: g.id,
    name: patch.name ?? g.name,
    type: patch.type ?? g.type,
    createdAt: g.createdAt,
    updatedAt: patch.updatedAt ?? new Date(),
    dirty: patch.dirty ?? true,
  };
}

export function sheetGroupToJson(g: SheetGroup): Record<string, unknown> {
  return {
    id: g.id,
    name: g.name,
    type: groupTypeToJson(g.type),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    dirty: g.dirty,
  };
}

export function sheetGroupFromJson(json: Record<string, unknown>): SheetGroup {
  const id = json['id'];
  const name = json['name'];
  const type = json['type'];
  const createdAt = json['createdAt'];
  const updatedAt = json['updatedAt'];
  if (typeof id !== 'string') throw new Error('SheetGroup.id fehlt oder ist kein String');
  if (typeof name !== 'string') throw new Error('SheetGroup.name fehlt oder ist kein String');
  if (typeof type !== 'string') throw new Error('SheetGroup.type fehlt oder ist kein String');
  if (typeof createdAt !== 'string') throw new Error('SheetGroup.createdAt fehlt');
  if (typeof updatedAt !== 'string') throw new Error('SheetGroup.updatedAt fehlt');
  return {
    id,
    name,
    type: groupTypeFromJson(type),
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    dirty: json['dirty'] === true,
  };
}
