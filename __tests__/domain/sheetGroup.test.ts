import { GroupType, groupTypeFromJson, groupTypeToJson } from '@/domain/models/groupType';
import {
  copySheetGroup,
  sheetGroupFromJson,
  sheetGroupToJson,
  type SheetGroup,
} from '@/domain/models/sheetGroup';

describe('SheetGroup', () => {
  test('JSON-Roundtrip: alle Felder bleiben erhalten', () => {
    const original: SheetGroup = {
      id: 'g-1',
      name: 'Saison 2025/26',
      type: GroupType.season,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T12:00:00.000Z'),
      dirty: true,
    };
    const restored = sheetGroupFromJson(sheetGroupToJson(original));
    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.type).toBe(original.type);
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    expect(restored.updatedAt.toISOString()).toBe(original.updatedAt.toISOString());
    expect(restored.dirty).toBe(original.dirty);
  });

  test('copySheetGroup aktualisiert nur die uebergebenen Felder', () => {
    const original: SheetGroup = {
      id: 'g-1',
      name: 'Alt',
      type: GroupType.season,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      dirty: true,
    };
    const copy = copySheetGroup(original, { name: 'Neu', type: GroupType.tournament });
    expect(copy.id).toBe('g-1');
    expect(copy.name).toBe('Neu');
    expect(copy.type).toBe(GroupType.tournament);
    expect(copy.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    expect(copy.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
    expect(copy.dirty).toBe(true);
  });

  test('GroupType-Serialisierung', () => {
    expect(groupTypeToJson(GroupType.season)).toBe('season');
    expect(groupTypeToJson(GroupType.tournament)).toBe('tournament');
    expect(groupTypeFromJson('season')).toBe(GroupType.season);
    expect(groupTypeFromJson('tournament')).toBe(GroupType.tournament);
    expect(groupTypeFromJson('unknown')).toBe(GroupType.season);
  });
});
