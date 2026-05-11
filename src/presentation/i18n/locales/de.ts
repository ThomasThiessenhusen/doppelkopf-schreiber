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
  home: {
    filterAll: 'Alle Spielboegen',
    filterGroupSummary: '{{name}} ({{type}})',
    rankings: 'Rangliste',
    open: 'Oeffnen',
    deleteMenu: 'Loeschen',
    newSheet: 'Neuer Spielbogen',
    managementGroups: 'Gruppen verwalten',
    deleteTitle: 'Spielbogen loeschen?',
    deleteBody: 'Der Spielbogen „{{title}}" wird endgueltig geloescht.',
    metaLine: '{{playerCount}} Spieler  ·  {{gameCount}} Spiele  ·  {{time}}',
    defaultTitle: 'Spielbogen {{date}}',
    emptyFiltered: 'Keine Spielbogen in „{{groupName}}"',
    emptyAll: 'Noch keine Spielbogen',
    emptyHintFiltered:
      'Lege einen neuen Spielbogen in dieser Gruppe an oder hebe den Filter auf, um alle Spielbogen zu sehen.',
    emptyHintAll: 'Tippe auf „Neuer Spielbogen", um den ersten Spielbogen anzulegen.',
    clearFilter: 'Filter aufheben',
  },
} as const;

/** Shape-compatible type: same keys as `de`, but string values (allows other locales). */
type DeepStringMap<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringMap<T[K]>;
};

export type Resources = DeepStringMap<typeof de>;
