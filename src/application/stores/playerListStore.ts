import { create } from 'zustand';

import {
  createPlayer,
  playerDisplayName,
  type Player,
} from '@/domain/models/player';
import { repositories } from '@/application/stores/repositories';
import { isPlayerReferenced, PlayerReferencedError } from '@/application/playerUsage';

export interface PlayerListState {
  loading: boolean;
  players: ReadonlyArray<Player>;
  error: Error | null;
  refresh: () => Promise<void>;
  add: (input: {
    playerName: string;
    firstName?: string | null;
    lastName?: string | null;
  }) => Promise<Player>;
  update: (updated: Player) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function sortByDisplayName(players: ReadonlyArray<Player>): Player[] {
  return [...players].sort((a, b) =>
    playerDisplayName(a).toLowerCase().localeCompare(playerDisplayName(b).toLowerCase()),
  );
}

export const usePlayerListStore = create<PlayerListState>((set, get) => ({
  loading: true,
  players: [],
  error: null,

  async refresh() {
    set({ loading: true, error: null });
    try {
      const players = await repositories.player().loadAll();
      set({ loading: false, players, error: null });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  },

  async add(input) {
    const player = createPlayer(input);
    await repositories.player().save(player);
    set({ players: sortByDisplayName([...get().players, player]) });
    return player;
  },

  async update(updated) {
    await repositories.player().save(updated);
    const next = get().players.map((p) => (p.id === updated.id ? updated : p));
    set({ players: sortByDisplayName(next) });
  },

  async remove(id) {
    if (await isPlayerReferenced(id)) {
      throw new PlayerReferencedError(id);
    }
    await repositories.player().delete(id);
    set({ players: get().players.filter((p) => p.id !== id) });
  },
}));
