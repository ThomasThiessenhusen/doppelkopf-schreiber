import { create } from 'zustand';

import type { PaperGrid } from '@/application/paper/paperGrid';

/**
 * Haelt den Entwurf eines Papier-Spielbogens zwischen Start- und
 * Raster-Screen. Bewusst fluechtig: nach einem App-Neustart beginnt man neu.
 */
export interface PaperDraftState {
  grid: PaperGrid | null;
  setGrid: (grid: PaperGrid | null) => void;
  reset: () => void;
}

export const usePaperDraftStore = create<PaperDraftState>((set) => ({
  grid: null,
  setGrid: (grid) => set({ grid }),
  reset: () => set({ grid: null }),
}));
