/**
 * Vertretung auf einem Spielbogen: Ein Gast (`substituteId`, spielt auf dem
 * Bogen) spielt im Namen eines Stammspielers (`mainPlayerId`, spielt auf
 * diesem Bogen nicht mit). Wirkt nur auf die Platzierungspunkte der
 * Gruppen-Rangliste.
 */
export interface Substitution {
  readonly substituteId: string;
  readonly mainPlayerId: string;
}

function isValidPair(playerIds: readonly string[], s: Substitution): boolean {
  return playerIds.includes(s.substituteId) && !playerIds.includes(s.mainPlayerId);
}

/**
 * Gueltig, wenn jeder Gast auf dem Bogen spielt, kein Stammspieler auf dem
 * Bogen spielt und jeder Gast bzw. Stammspieler hoechstens einmal vorkommt.
 */
export function isValidSubstitutionList(
  playerIds: readonly string[],
  subs: readonly Substitution[],
): boolean {
  return effectiveSubstitutions(playerIds, subs).length === subs.length;
}

/**
 * Defensiver Filter: behaelt in Reihenfolge nur Paare, die einzeln gueltig
 * sind und deren Gast/Stammspieler nicht schon in einem frueheren
 * behaltenen Paar vorkommt.
 */
export function effectiveSubstitutions(
  playerIds: readonly string[],
  subs: readonly Substitution[],
): readonly Substitution[] {
  const usedSubstitutes = new Set<string>();
  const usedMains = new Set<string>();
  const out: Substitution[] = [];
  for (const s of subs) {
    if (!isValidPair(playerIds, s)) continue;
    if (usedSubstitutes.has(s.substituteId) || usedMains.has(s.mainPlayerId)) continue;
    usedSubstitutes.add(s.substituteId);
    usedMains.add(s.mainPlayerId);
    out.push(s);
  }
  return out;
}

export function substitutionToJson(s: Substitution): Record<string, unknown> {
  return { substituteId: s.substituteId, mainPlayerId: s.mainPlayerId };
}

/** Liest eine Liste; Eintraege ohne zwei String-Felder werden verworfen. */
export function substitutionsFromJson(raw: unknown): readonly Substitution[] {
  if (!Array.isArray(raw)) return [];
  const out: Substitution[] = [];
  for (const e of raw) {
    if (e === null || typeof e !== 'object') continue;
    const rec = e as Record<string, unknown>;
    const substituteId = rec['substituteId'];
    const mainPlayerId = rec['mainPlayerId'];
    if (typeof substituteId === 'string' && typeof mainPlayerId === 'string') {
      out.push({ substituteId, mainPlayerId });
    }
  }
  return out;
}
