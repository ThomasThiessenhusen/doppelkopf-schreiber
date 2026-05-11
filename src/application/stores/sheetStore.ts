import { create } from 'zustand';

import type { Game } from '@/domain/models/game';
import {
  copyGameSheet,
  removeGame as removeSheetGame,
  replaceGame as replaceSheetGame,
  sheetWithGame,
  type GameSheet,
} from '@/domain/models/gameSheet';
import type { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import {
  asyncData,
  asyncError,
  asyncLoading,
  type AsyncState,
} from '@/application/stores/asyncState';
import { repositories } from '@/application/stores/repositories';
import { useSheetListStore } from '@/application/stores/sheetListStore';

export interface SheetStoreState {
  state: AsyncState<GameSheet>;
  load: (sheetId: string) => Promise<void>;
  addGame: (game: Game) => Promise<void>;
  updateGame: (game: Game) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  renameSheet: (title: string | null) => Promise<void>;
  setStackingModeOverride: (mode: BockStackingMode | null) => Promise<void>;
  setGroup: (groupId: string | null) => Promise<void>;
}

async function persist(sheet: GameSheet): Promise<void> {
  await repositories.gameSheet().save(sheet);
  useSheetListStore.getState().upsertLocal(sheet);
}

export const useSheetStore = create<SheetStoreState>((set, get) => ({
  state: asyncLoading,

  async load(sheetId) {
    set({ state: asyncLoading });
    try {
      const sheet = await repositories.gameSheet().load(sheetId);
      if (sheet === null) {
        set({ state: asyncError(new Error(`Spielbogen nicht gefunden: ${sheetId}`)) });
      } else {
        set({ state: asyncData(sheet) });
      }
    } catch (e) {
      set({ state: asyncError(e) });
    }
  },

  async addGame(game) {
    const cur = get().state;
    if (cur.status !== 'data') return;
    const next = sheetWithGame(cur.value, game);
    set({ state: asyncData(next) });
    await persist(next);
  },

  async updateGame(game) {
    const cur = get().state;
    if (cur.status !== 'data') return;
    const next = replaceSheetGame(cur.value, game);
    set({ state: asyncData(next) });
    await persist(next);
  },

  async deleteGame(gameId) {
    const cur = get().state;
    if (cur.status !== 'data') return;
    const next = removeSheetGame(cur.value, gameId);
    set({ state: asyncData(next) });
    await persist(next);
  },

  async renameSheet(title) {
    const cur = get().state;
    if (cur.status !== 'data') return;
    const next = copyGameSheet(cur.value, { title });
    set({ state: asyncData(next) });
    await persist(next);
  },

  async setStackingModeOverride(mode) {
    const cur = get().state;
    if (cur.status !== 'data') return;
    const next = copyGameSheet(cur.value, { stackingModeOverride: mode });
    set({ state: asyncData(next) });
    await persist(next);
  },

  async setGroup(groupId) {
    const cur = get().state;
    if (cur.status !== 'data') return;
    const next = copyGameSheet(cur.value, { groupId });
    set({ state: asyncData(next) });
    await persist(next);
  },
}));
