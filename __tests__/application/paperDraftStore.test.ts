import { emptyGrid } from '@/application/paper/paperGrid';
import { usePaperDraftStore } from '@/application/stores/paperDraftStore';

describe('paperDraftStore', () => {
  beforeEach(() => usePaperDraftStore.getState().reset());

  test('startet ohne Entwurf', () => {
    expect(usePaperDraftStore.getState().grid).toBeNull();
  });

  test('setGrid speichert den Entwurf, reset leert ihn', () => {
    const grid = emptyGrid(4, new Date('2026-11-10T12:00:00.000Z'));
    usePaperDraftStore.getState().setGrid(grid);
    expect(usePaperDraftStore.getState().grid).toBe(grid);
    usePaperDraftStore.getState().reset();
    expect(usePaperDraftStore.getState().grid).toBeNull();
  });
});
