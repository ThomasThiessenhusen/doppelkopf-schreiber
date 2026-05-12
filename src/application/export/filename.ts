const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

/**
 * Erzeugt einen lesbaren Dateinamen `bockzettel-<scope>-<date>.json`.
 * Normalisiert `scope` zu ASCII-Lower-Case + Bindestrichen; bei leerem
 * Ergebnis Fallback `bogen`.
 */
export function suggestFilename(scope: string, dateIso: string): string {
  const slug = slugify(scope);
  const safeScope = slug === '' ? 'bogen' : slug;
  return `bockzettel-${safeScope}-${dateIso}.json`;
}

function slugify(s: string): string {
  const folded = [...s.trim()]
    .map((c) => UMLAUT_MAP[c] ?? c)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
