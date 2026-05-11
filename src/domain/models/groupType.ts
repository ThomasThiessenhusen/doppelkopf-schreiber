/**
 * Klassifiziert eine Gruppe semantisch — rein kosmetische Wirkung
 * (Label in Listen/Headern); funktional sind Saison und Turnier identisch.
 */
export type GroupType = 'season' | 'tournament';

export const GroupType = {
  season: 'season' as const,
  tournament: 'tournament' as const,
};

/** Translation-Key fuer den Anzeigenamen eines GroupType. */
export type GroupTypeLabelKey = 'groupType.season' | 'groupType.tournament';

export function groupTypeLabelKey(type: GroupType): GroupTypeLabelKey {
  return type === 'season' ? 'groupType.season' : 'groupType.tournament';
}

export function groupTypeToJson(t: GroupType): string {
  return t;
}

/** Unbekannte Strings fallen auf 'season' zurueck (Default). */
export function groupTypeFromJson(s: string): GroupType {
  return s === 'tournament' ? 'tournament' : 'season';
}
