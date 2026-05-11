import { create } from 'zustand';

import type { GameSheet } from '@/domain/models/gameSheet';
import { repositories } from '@/application/stores/repositories';

export interface SheetListState {
  loading: boolean;
  sheets: ReadonlyArray<GameSheet>;
  error: Error | null;
  refresh: () => Promise<void>;
  createSheet: (sheet: GameSheet) => Promise<GameSheet>;
  deleteSheet: (id: string) => Promise<void>;
  /**
   * Vom `sheetStore` aufgerufen, wenn der einzelne Bogen aktualisiert wird —
   * haelt die Liste konsistent, ohne sie neu zu laden.
   */
  upsertLocal: (sheet: GameSheet) => void;
}

export const useSheetListStore = create<SheetListState>((set, get) => ({
  loading: true,
  sheets: [],
  error: null,

  async refresh() {
    set({ loading: true, error: null });
    try {
      const sheets = await repositories.gameSheet().loadAll();
      set({ loading: false, sheets, error: null });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  },

  async createSheet(sheet) {
    await repositories.gameSheet().save(sheet);
    set({ sheets: [sheet, ...get().sheets] });
    return sheet;
  },

  async deleteSheet(id) {
    await repositories.gameSheet().delete(id);
    set({ sheets: get().sheets.filter((s) => s.id !== id) });
  },

  upsertLocal(sheet) {
    const others = get().sheets.filter((s) => s.id !== sheet.id);
    set({ sheets: [sheet, ...others] });
  },
}));
