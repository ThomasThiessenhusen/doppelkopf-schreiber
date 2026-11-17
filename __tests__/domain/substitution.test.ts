import {
  effectiveSubstitutions,
  isValidSubstitutionList,
  type Substitution,
} from '@/domain/models/substitution';

const ids = ['a', 'b', 'c', 'd'];
const sub = (substituteId: string, mainPlayerId: string): Substitution => ({
  substituteId,
  mainPlayerId,
});

describe('isValidSubstitutionList', () => {
  test('gueltiges Paar', () => {
    expect(isValidSubstitutionList(ids, [sub('a', 'x')])).toBe(true);
  });
  test('leere Liste ist gueltig', () => {
    expect(isValidSubstitutionList(ids, [])).toBe(true);
  });
  test('Stammspieler spielt selbst auf dem Bogen -> ungueltig', () => {
    expect(isValidSubstitutionList(ids, [sub('a', 'b')])).toBe(false);
  });
  test('Gast nicht im Bogen -> ungueltig', () => {
    expect(isValidSubstitutionList(ids, [sub('z', 'x')])).toBe(false);
  });
  test('Gast doppelt -> ungueltig', () => {
    expect(isValidSubstitutionList(ids, [sub('a', 'x'), sub('a', 'y')])).toBe(false);
  });
  test('Stammspieler doppelt -> ungueltig', () => {
    expect(isValidSubstitutionList(ids, [sub('a', 'x'), sub('b', 'x')])).toBe(false);
  });
});

describe('effectiveSubstitutions', () => {
  test('filtert ungueltige und doppelte Paare in Reihenfolge', () => {
    expect(
      effectiveSubstitutions(ids, [
        sub('a', 'x'),
        sub('a', 'y'),
        sub('b', 'c'),
        sub('c', 'x'),
        sub('d', 'w'),
      ]),
    ).toEqual([sub('a', 'x'), sub('d', 'w')]);
  });
});
