import {
  ensurePoolMembership,
  isPlayerReferenced,
  PlayerReferencedError,
  referencedIdsFromSheets,
} from '@/application/playerUsage';
import {
  _overrideRepositoriesForTest,
  repositories,
} from '@/application/stores/repositories';
import { createLocalGameSheetRepository } from '@/data/repositories/gameSheetRepository';
import { createLocalPlayerRepository } from '@/data/repositories/playerRepository';
import { createInMemoryStorage } from '../data/_inMemoryStorage';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';

/**
 * Erstellt ein minimales GameSheet fuer Tests.
 * Wenn `pad` true ist (Standard), werden die playerIds auf 4 Eintraege
 * aufgefuellt, damit der Repository-Deserialisierer keine Validierungsfehler
 * wirft. Fuer reine In-Memory-Tests (ohne Repository-Roundtrip) kann
 * `pad: false` gesetzt werden.
 */
function sheet(
  id: string,
  playerIds: readonly string[],
  pad = true,
): GameSheet {
  const now = new Date('2026-05-12T00:00:00.000Z');
  const filler = ['__f1__', '__f2__', '__f3__', '__f4__'];
  const finalIds = pad
    ? [...playerIds, ...filler].slice(0, Math.max(4, playerIds.length))
    : playerIds;
  return {
    id,
    title: null,
    createdAt: now,
    updatedAt: now,
    playerIds: finalIds,
    rounds: [],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}

beforeEach(() => {
  const storage = createInMemoryStorage();
  _overrideRepositoriesForTest({
    storage,
    player: createLocalPlayerRepository(storage),
    gameSheet: createLocalGameSheetRepository(storage),
  });
});

describe('isPlayerReferenced', () => {
  test('true when at least one sheet contains the id', async () => {
    await repositories.gameSheet().save(sheet('s1', ['a', 'b']));
    expect(await isPlayerReferenced('a')).toBe(true);
  });
  test('false when no sheet contains the id', async () => {
    await repositories.gameSheet().save(sheet('s1', ['a']));
    expect(await isPlayerReferenced('z')).toBe(false);
  });
});

describe('referencedIdsFromSheets', () => {
  test('returns union over sheets', () => {
    // referencedIdsFromSheets ist eine reine Funktion — kein Repository-Roundtrip
    // noetig, daher werden Sheets direkt ohne Padding konstruiert.
    const sheets = [
      sheet('s1', ['a', 'b'], false),
      sheet('s2', ['b', 'c'], false),
    ];
    expect(referencedIdsFromSheets(sheets)).toEqual(new Set(['a', 'b', 'c']));
  });
});

describe('ensurePoolMembership', () => {
  test('adds only missing players', async () => {
    const existing: Player = {
      id: 'a',
      playerName: 'AnnaPool',
      firstName: null,
      lastName: null,
    };
    await repositories.player().save(existing);

    const candidates: readonly Player[] = [
      { id: 'a', playerName: 'IgnoredName', firstName: null, lastName: null },
      { id: 'b', playerName: 'Ben', firstName: null, lastName: null },
    ];
    await ensurePoolMembership(candidates);

    const pool = await repositories.player().loadAll();
    const ids = pool.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b']);
    const anna = pool.find((p) => p.id === 'a');
    expect(anna?.playerName).toBe('AnnaPool');
  });
});

describe('PlayerReferencedError', () => {
  test('carries the playerId', () => {
    const err = new PlayerReferencedError('a');
    expect(err).toBeInstanceOf(Error);
    expect(err.playerId).toBe('a');
    expect(err.name).toBe('PlayerReferencedError');
  });
});
