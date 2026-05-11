/**
 * Klassifiziert eine Gruppe semantisch — rein kosmetische Wirkung
 * (Label in Listen/Headern); funktional sind Saison und Turnier identisch.
 */
export type GroupType = 'season' | 'tournament';

export const GroupType = {
  season: 'season' as const,
  tournament: 'tournament' as const,
};

export function groupTypeLabel(t: GroupType): string {
  return t === 'season' ? 'Saison' : 'Turnier';
}

export function groupTypeToJson(t: GroupType): string {
  return t;
}

/** Unbekannte Strings fallen auf 'season' zurueck (Default). */
export function groupTypeFromJson(s: string): GroupType {
  return s === 'tournament' ? 'tournament' : 'season';
}
