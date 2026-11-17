import type { Player } from '@/domain/models/player';

export interface PlayerLookup {
  byId(id: string): Player | null;
}

export function createPlayerLookup(pool: readonly Player[]): PlayerLookup {
  const map = new Map<string, Player>();
  for (const p of pool) {
    map.set(p.id, p);
  }
  return {
    byId(id) {
      return map.get(id) ?? null;
    },
  };
}

interface SheetLike {
  readonly playerIds: readonly string[];
}

export function resolveSheetPlayers(
  sheet: SheetLike,
  lookup: PlayerLookup,
): readonly Player[] {
  return sheet.playerIds.map((id) => {
    const p = lookup.byId(id);
    if (p !== null) return p;
    return { id, playerName: '', firstName: null, lastName: null };
  });
}
