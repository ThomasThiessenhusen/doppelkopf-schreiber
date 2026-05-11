import type { Resources } from './de';

export const en: Resources = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    close: 'Close',
    retry: 'Retry',
    loading: 'Loading …',
    errorLoading: 'Failed to load',
  },
  nav: {
    home: 'Bockzettel',
    newSheet: 'New sheet',
    sheet: 'Sheet',
    addGame: 'Add game',
    groups: 'Groups',
    rankings: 'Rankings',
    players: 'Players',
    settings: 'Settings',
  },
  settings: {
    stackingTitle: 'Default bock-round stacking',
    stackingHint:
      'Used as default when creating new sheets. Can be overridden per sheet.',
    stackingSequential: 'Sequential',
    stackingDoppelbock: 'Doppelbock',
    languageTitle: 'Language',
    languageSystem: 'System language',
    languageDe: 'German',
    languageEn: 'English',
  },
  home: {
    filterAll: 'All sheets',
    filterGroupSummary: '{{name}} ({{type}})',
    rankings: 'Rankings',
    open: 'Open',
    deleteMenu: 'Delete',
    newSheet: 'New sheet',
    managementGroups: 'Manage groups',
    deleteTitle: 'Delete sheet?',
    deleteBody: 'The sheet "{{title}}" will be permanently deleted.',
    metaLine: '{{playerCount}} players  ·  {{gameCount}} games  ·  {{time}}',
    defaultTitle: 'Sheet {{date}}',
    emptyFiltered: 'No sheets in "{{groupName}}"',
    emptyAll: 'No sheets yet',
    emptyHintFiltered:
      'Create a new sheet in this group, or clear the filter to see all sheets.',
    emptyHintAll: 'Tap "New sheet" to create your first sheet.',
    clearFilter: 'Clear filter',
  },
};
