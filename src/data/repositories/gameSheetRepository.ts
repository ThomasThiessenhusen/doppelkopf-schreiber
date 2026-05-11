import type { LocalStorage } from '@/data/local/localStorage';
import {
  gameSheetFromJson,
  gameSheetToJson,
  type GameSheet,
} from '@/domain/models/gameSheet';

export interface GameSheetRepository {
  loadAll(): Promise<ReadonlyArray<GameSheet>>;
  load(id: string): Promise<GameSheet | null>;
  save(sheet: GameSheet): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * JSON-File-Storage-Implementierung von `GameSheetRepository`. Pro
 * Spielbogen eine Datei unter der Collection `game_sheets`. `loadAll()`
 * sortiert absteigend nach `updatedAt` — neueste zuerst.
 */
export function createLocalGameSheetRepository(
  storage: LocalStorage,
): GameSheetRepository {
  const COLLECTION = 'game_sheets';

  return {
    async loadAll() {
      const raw = await storage.readAll(COLLECTION);
      const sheets = raw.map(gameSheetFromJson);
      sheets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return sheets;
    },
    async load(id) {
      const raw = await storage.readOne(COLLECTION, id);
      return raw === null ? null : gameSheetFromJson(raw);
    },
    async save(sheet) {
      await storage.write(COLLECTION, sheet.id, gameSheetToJson(sheet));
    },
    async delete(id) {
      await storage.delete(COLLECTION, id);
    },
  };
}
