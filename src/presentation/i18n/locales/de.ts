export const de = {
  common: {
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Loeschen',
    close: 'Schliessen',
    retry: 'Erneut versuchen',
    loading: 'Laedt …',
    errorLoading: 'Fehler beim Laden',
  },
  nav: {
    home: 'Bockzettel',
    newSheet: 'Neuer Spielbogen',
    sheet: 'Spielbogen',
    addGame: 'Spiel eintragen',
    groups: 'Gruppen',
    rankings: 'Rangliste',
    players: 'Spieler',
    settings: 'Einstellungen',
  },
  settings: {
    stackingTitle: 'Standard-Bockrunden-Stapelung',
    stackingHint:
      'Wird beim Anlegen neuer Spielbogen als Default verwendet. Pro Bogen ueberschreibbar.',
    stackingSequential: 'Sequenziell',
    stackingDoppelbock: 'Doppelbock',
    languageTitle: 'Sprache',
    languageSystem: 'Systemsprache',
    languageDe: 'Deutsch',
    languageEn: 'Englisch',
  },
} as const;

/** Shape-compatible type: same keys as `de`, but string values (allows other locales). */
type DeepStringMap<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringMap<T[K]>;
};

export type Resources = DeepStringMap<typeof de>;
