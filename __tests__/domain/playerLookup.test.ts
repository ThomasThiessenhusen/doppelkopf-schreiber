import {
  createPlayerLookup,
  resolveSheetPlayers,
} from '@/domain/models/playerLookup';
import type { Player } from '@/domain/models/player';

const anna: Player = { id: 'a', playerName: 'Anna', firstName: null, lastName: null };
const ben: Player = { id: 'b', playerName: 'Ben', firstName: null, lastName: null };

function sheetWith(playerIds: ReadonlyArray<string>) {
  return { playerIds };
}

describe('createPlayerLookup', () => {
  test('byId returns the same instance for repeated calls', () => {
    const lookup = createPlayerLookup([anna, ben]);
    expect(lookup.byId('a')).toBe(lookup.byId('a'));
  });
  test('unknown id returns null', () => {
    const lookup = createPlayerLookup([anna]);
    expect(lookup.byId('zz')).toBe(null);
  });
  test('empty pool: byId always returns null', () => {
    const lookup = createPlayerLookup([]);
    expect(lookup.byId('anything')).toBe(null);
  });
});

describe('resolveSheetPlayers', () => {
  test('preserves playerIds order', () => {
    const lookup = createPlayerLookup([ben, anna]);
    const sheet = sheetWith(['a', 'b']);
    const resolved = resolveSheetPlayers(sheet, lookup);
    expect(resolved.map((p) => p.playerName)).toEqual(['Anna', 'Ben']);
  });
  test('missing id yields placeholder with empty name and the id', () => {
    const lookup = createPlayerLookup([anna]);
    const sheet = sheetWith(['a', 'missing']);
    const resolved = resolveSheetPlayers(sheet, lookup);
    expect(resolved[1]).toEqual({
      id: 'missing',
      playerName: '',
      firstName: null,
      lastName: null,
    });
  });
});
