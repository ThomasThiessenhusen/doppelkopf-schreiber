import { create } from 'zustand';

import { appSettingsFallback, type AppSettings } from '@/domain/models/appSettings';
import type { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import {
  asyncData,
  asyncError,
  asyncLoading,
  type AsyncState,
} from '@/application/stores/asyncState';
import { repositories } from '@/application/stores/repositories';

export interface SettingsStoreState {
  state: AsyncState<AppSettings>;
  load: () => Promise<void>;
  setDefaultStackingMode: (mode: BockStackingMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  state: asyncLoading,

  async load() {
    set({ state: asyncLoading });
    try {
      const settings = await repositories.settings().load();
      set({ state: asyncData(settings) });
    } catch (e) {
      set({ state: asyncError(e) });
    }
  },

  async setDefaultStackingMode(mode) {
    const cur = get().state;
    const current = cur.status === 'data' ? cur.value : appSettingsFallback;
    const next: AppSettings = { ...current, defaultStackingMode: mode };
    set({ state: asyncData(next) });
    await repositories.settings().save(next);
  },
}));
