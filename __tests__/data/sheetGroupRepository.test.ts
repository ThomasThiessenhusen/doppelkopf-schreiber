import { createInMemoryStorage } from './_inMemoryStorage';
import { createLocalSheetGroupRepository } from '@/data/repositories/sheetGroupRepository';
import { GroupType } from '@/domain/models/groupType';
import type { SheetGroup } from '@/domain/models/sheetGroup';

function group(id: string, name: string, type: GroupType = GroupType.season): SheetGroup {
  const now = new Date('2026-05-08T10:00:00.000Z');
  return {
    id,
    name,
    type,
    createdAt: now,
    updatedAt: now,
    dirty: false,
  };
}

describe('LocalSheetGroupRepository', () => {
  test('save + load Roundtrip', async () => {
    const repo = createLocalSheetGroupRepository(createInMemoryStorage());
    await repo.save(group('g-1', 'Saison 1'));
    const restored = await repo.load('g-1');
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe('g-1');
    expect(restored!.name).toBe('Saison 1');
  });

  test('load mit unbekannter ID liefert null', async () => {
    const repo = createLocalSheetGroupRepository(createInMemoryStorage());
    expect(await repo.load('nope')).toBeNull();
  });

  test('loadAll liefert alle gespeicherten Gruppen', async () => {
    const repo = createLocalSheetGroupRepository(createInMemoryStorage());
    await repo.save(group('g-1', 'A'));
    await repo.save(group('g-2', 'B', GroupType.tournament));
    const all = await repo.loadAll();
    expect(all.length).toBe(2);
    expect(new Set(all.map((g) => g.id))).toEqual(new Set(['g-1', 'g-2']));
  });

  test('delete entfernt eine Gruppe', async () => {
    const repo = createLocalSheetGroupRepository(createInMemoryStorage());
    await repo.save(group('g-1', 'A'));
    await repo.delete('g-1');
    expect(await repo.load('g-1')).toBeNull();
  });
});
