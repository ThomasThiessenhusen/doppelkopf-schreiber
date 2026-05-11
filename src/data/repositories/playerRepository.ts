import type { LocalStorage } from '@/data/local/localStorage';
import {
  playerDisplayName,
  playerFromJson,
  playerToJson,
  type Player,
} from '@/domain/models/player';

export interface PlayerRepository {
  loadAll(): Promise<ReadonlyArray<Player>>;
  save(player: Player): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Repository fuer den app-weiten Spielerpool. Spieler in einem konkreten
 * Spielbogen sind Snapshots — sie werden im Spielbogen mitgespeichert,
 * damit Umbenennen/Loeschen im Pool die Historie nicht veraendert.
 *
 * `loadAll()` sortiert nach `displayName` case-insensitive.
 */
export function createLocalPlayerRepository(storage: LocalStorage): PlayerRepository {
  const COLLECTION = 'players';

  return {
    async loadAll() {
      const raw = await storage.readAll(COLLECTION);
      const players = raw.map(playerFromJson);
      players.sort((a, b) =>
        playerDisplayName(a).toLowerCase().localeCompare(playerDisplayName(b).toLowerCase()),
      );
      return players;
    },
    async save(player) {
      await storage.write(COLLECTION, player.id, playerToJson(player));
    },
    async delete(id) {
      await storage.delete(COLLECTION, id);
    },
  };
}
