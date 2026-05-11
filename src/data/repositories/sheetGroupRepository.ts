import type { LocalStorage } from '@/data/local/localStorage';
import {
  sheetGroupFromJson,
  sheetGroupToJson,
  type SheetGroup,
} from '@/domain/models/sheetGroup';

export interface SheetGroupRepository {
  loadAll(): Promise<ReadonlyArray<SheetGroup>>;
  load(id: string): Promise<SheetGroup | null>;
  save(group: SheetGroup): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * JSON-File-Storage-Implementierung von `SheetGroupRepository`. Pro Gruppe
 * eine Datei unter der Collection `sheet_groups`. `loadAll()` sortiert
 * absteigend nach `updatedAt` — neueste zuerst.
 */
export function createLocalSheetGroupRepository(
  storage: LocalStorage,
): SheetGroupRepository {
  const COLLECTION = 'sheet_groups';

  return {
    async loadAll() {
      const raw = await storage.readAll(COLLECTION);
      const groups = raw.map(sheetGroupFromJson);
      groups.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return groups;
    },
    async load(id) {
      const raw = await storage.readOne(COLLECTION, id);
      return raw === null ? null : sheetGroupFromJson(raw);
    },
    async save(group) {
      await storage.write(COLLECTION, group.id, sheetGroupToJson(group));
    },
    async delete(id) {
      await storage.delete(COLLECTION, id);
    },
  };
}
