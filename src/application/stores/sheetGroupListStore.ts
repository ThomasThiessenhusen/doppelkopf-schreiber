import { create } from 'zustand';

import { newId } from '@/core/id';
import { copyGameSheet } from '@/domain/models/gameSheet';
import { type GroupType } from '@/domain/models/groupType';
import {
  copySheetGroup,
  type SheetGroup,
} from '@/domain/models/sheetGroup';
import { repositories } from '@/application/stores/repositories';
import { useSheetListStore } from '@/application/stores/sheetListStore';

export interface SheetGroupListState {
  loading: boolean;
  groups: ReadonlyArray<SheetGroup>;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (input: { name: string; type: GroupType }) => Promise<SheetGroup>;
  rename: (id: string, newName: string) => Promise<void>;
  setType: (id: string, newType: GroupType) => Promise<void>;
  /**
   * Loescht die Gruppe und entkoppelt alle zugeordneten Spielboegen
   * (setzt deren `groupId` auf null). Die Spielboegen bleiben erhalten.
   */
  deleteWithSheetsDecoupled: (id: string) => Promise<void>;
  /** Loescht die Gruppe samt allen zugeordneten Spielboegen. */
  deleteWithSheetsCascaded: (id: string) => Promise<void>;
}

export const useSheetGroupListStore = create<SheetGroupListState>((set, get) => ({
  loading: true,
  groups: [],
  error: null,

  async refresh() {
    set({ loading: true, error: null });
    try {
      const groups = await repositories.sheetGroup().loadAll();
      set({ loading: false, groups, error: null });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  },

  async create(input) {
    const now = new Date();
    const group: SheetGroup = {
      id: newId(),
      name: input.name,
      type: input.type,
      createdAt: now,
      updatedAt: now,
      dirty: true,
    };
    await repositories.sheetGroup().save(group);
    set({ groups: [group, ...get().groups] });
    return group;
  },

  async rename(id, newName) {
    const group = get().groups.find((g) => g.id === id);
    if (group === undefined) return;
    const updated = copySheetGroup(group, { name: newName });
    await repositories.sheetGroup().save(updated);
    set({
      groups: get().groups.map((g) => (g.id === id ? updated : g)),
    });
  },

  async setType(id, newType) {
    const group = get().groups.find((g) => g.id === id);
    if (group === undefined) return;
    const updated = copySheetGroup(group, { type: newType });
    await repositories.sheetGroup().save(updated);
    set({
      groups: get().groups.map((g) => (g.id === id ? updated : g)),
    });
  },

  async deleteWithSheetsDecoupled(id) {
    const allSheets = await repositories.gameSheet().loadAll();
    const sheetListStore = useSheetListStore.getState();
    for (const sheet of allSheets) {
      if (sheet.groupId === id) {
        const updated = copyGameSheet(sheet, { groupId: null });
        await repositories.gameSheet().save(updated);
        sheetListStore.upsertLocal(updated);
      }
    }
    await repositories.sheetGroup().delete(id);
    set({ groups: get().groups.filter((g) => g.id !== id) });
  },

  async deleteWithSheetsCascaded(id) {
    const allSheets = await repositories.gameSheet().loadAll();
    for (const sheet of allSheets) {
      if (sheet.groupId === id) {
        await repositories.gameSheet().delete(sheet.id);
      }
    }
    await useSheetListStore.getState().refresh();
    await repositories.sheetGroup().delete(id);
    set({ groups: get().groups.filter((g) => g.id !== id) });
  },
}));
