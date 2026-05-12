import {
  copyPlayer,
  createPlayer,
  playerDisplayName,
  playerFromJson,
  playerFullName,
  playerToJson,
  type Player,
} from '@/domain/models/player';

const sample: Player = {
  id: 'p1',
  playerName: 'Otto',
  firstName: 'Ottokar',
  lastName: 'Meier',
};

describe('playerDisplayName', () => {
  test('liefert den Spielernamen', () => {
    expect(playerDisplayName(sample)).toBe('Otto');
  });
});

describe('playerFullName', () => {
  test('beide Namen gesetzt -> verbunden mit Leerzeichen', () => {
    expect(playerFullName(sample)).toBe('Ottokar Meier');
  });
  test('nur Vorname -> Vorname', () => {
    expect(playerFullName({ ...sample, lastName: null })).toBe('Ottokar');
  });
  test('nur Nachname -> Nachname', () => {
    expect(playerFullName({ ...sample, firstName: null })).toBe('Meier');
  });
  test('beide null -> leerer String', () => {
    expect(playerFullName({ ...sample, firstName: null, lastName: null })).toBe('');
  });
  test('Whitespace-only zaehlt als leer', () => {
    expect(playerFullName({ ...sample, firstName: '   ', lastName: '   ' })).toBe('');
  });
});

describe('createPlayer', () => {
  test('trimmt playerName, firstName/lastName optional', () => {
    const p = createPlayer({ playerName: '  Otto ' });
    expect(p.playerName).toBe('Otto');
    expect(p.firstName).toBe(null);
    expect(p.lastName).toBe(null);
  });
  test('leere Strings werden zu null', () => {
    const p = createPlayer({ playerName: 'Otto', firstName: '', lastName: '  ' });
    expect(p.firstName).toBe(null);
    expect(p.lastName).toBe(null);
  });
  test('echte Werte werden uebernommen und getrimmt', () => {
    const p = createPlayer({ playerName: 'Otto', firstName: '  Ottokar  ', lastName: 'Meier' });
    expect(p.firstName).toBe('Ottokar');
    expect(p.lastName).toBe('Meier');
  });
});

describe('copyPlayer', () => {
  test('playerName ueberschreibbar', () => {
    expect(copyPlayer(sample, { playerName: 'Otti' }).playerName).toBe('Otti');
  });
  test('firstName auf null setzen loescht', () => {
    expect(copyPlayer(sample, { firstName: null }).firstName).toBe(null);
  });
  test('weggelassenes Feld bleibt unveraendert', () => {
    expect(copyPlayer(sample, { playerName: 'Otti' }).lastName).toBe('Meier');
  });
});

describe('playerToJson', () => {
  test('playerName immer, firstName/lastName nur wenn non-null', () => {
    expect(playerToJson(sample)).toEqual({
      id: 'p1',
      playerName: 'Otto',
      firstName: 'Ottokar',
      lastName: 'Meier',
    });
    expect(playerToJson({ ...sample, firstName: null, lastName: null })).toEqual({
      id: 'p1',
      playerName: 'Otto',
    });
  });
  test('schreibt keinen nickname-Key', () => {
    const json = playerToJson(sample);
    expect('nickname' in json).toBe(false);
  });
});

describe('playerFromJson', () => {
  test('neues Schema -> playerName direkt', () => {
    expect(
      playerFromJson({ id: 'p1', playerName: 'Otto', firstName: 'O', lastName: 'M' }),
    ).toEqual({ id: 'p1', playerName: 'Otto', firstName: 'O', lastName: 'M' });
  });
  test('legacy nickname-Key -> als playerName', () => {
    const p = playerFromJson({ id: 'p1', nickname: 'Otti', firstName: 'O', lastName: 'M' });
    expect(p.playerName).toBe('Otti');
    expect(p.firstName).toBe('O');
    expect(p.lastName).toBe('M');
  });
  test('weder playerName noch nickname -> Komposition aus first/last', () => {
    const p = playerFromJson({ id: 'p1', firstName: 'Otto', lastName: 'Meier' });
    expect(p.playerName).toBe('Otto Meier');
    expect(p.firstName).toBe('Otto');
    expect(p.lastName).toBe('Meier');
  });
  test('sehr altes Schema (nur "name") -> als playerName', () => {
    const p = playerFromJson({ id: 'p1', name: 'Alt-Otto' });
    expect(p.playerName).toBe('Alt-Otto');
    expect(p.firstName).toBe(null);
    expect(p.lastName).toBe(null);
  });
  test('nur id -> playerName leer, firstName/lastName null', () => {
    expect(playerFromJson({ id: 'p1' })).toEqual({
      id: 'p1',
      playerName: '',
      firstName: null,
      lastName: null,
    });
  });
  test('id fehlt -> Error', () => {
    expect(() => playerFromJson({})).toThrow();
  });
});
