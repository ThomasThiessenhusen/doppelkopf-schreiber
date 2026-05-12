import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { repositories } from '@/application/stores/repositories';

/**
 * Geworfen, wenn versucht wird, einen Spieler aus dem Pool zu loeschen,
 * der noch in mindestens einem GameSheet referenziert wird.
 */
export class PlayerReferencedError extends Error {
  readonly playerId: string;
  constructor(playerId: string) {
    super(`Player ${playerId} is referenced by at least one sheet.`);
    this.name = 'PlayerReferencedError';
    this.playerId = playerId;
  }
}

/**
 * Prueft, ob ein Spieler in irgendeinem persistierten GameSheet vorkommt.
 * Laedt dafuer alle Sheets — fuer einen UI-batch besser
 * `referencedIdsFromSheets(loadedSheets)` verwenden.
 */
export async function isPlayerReferenced(playerId: string): Promise<boolean> {
  const sheets = await repositories.gameSheet().loadAll();
  return sheets.some((s) => s.playerIds.includes(playerId));
}

/**
 * Berechnet die Vereinigung aller in den uebergebenen Sheets verwendeten
 * Spieler-IDs. Pur — keine I/O.
 */
export function referencedIdsFromSheets(
  sheets: readonly GameSheet[],
): Set<string> {
  const out = new Set<string>();
  for (const sheet of sheets) {
    for (const id of sheet.playerIds) out.add(id);
  }
  return out;
}

/**
 * Stellt sicher, dass alle uebergebenen Spieler im app-weiten Pool
 * existieren. Bestehende Eintraege werden NICHT ueberschrieben. Wird vom
 * Sheet-Erstellungs-Pfad und (spaeter) vom Import-Pfad aufgerufen.
 */
export async function ensurePoolMembership(
  players: readonly Player[],
): Promise<void> {
  const existing = await repositories.player().loadAll();
  const have = new Set(existing.map((p) => p.id));
  for (const p of players) {
    if (!have.has(p.id)) {
      await repositories.player().save(p);
      have.add(p.id);
    }
  }
}
