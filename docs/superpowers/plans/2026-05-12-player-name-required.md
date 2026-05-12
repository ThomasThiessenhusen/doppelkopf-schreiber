# Player Name Required Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the player record's required field from `firstName + lastName` to a single mandatory `playerName`, with real names becoming optional. Renames the internal `nickname` field to `playerName` everywhere.

**Architecture:** Two implementation commits. Commit 1 rewrites the domain model (`player.ts`) with TDD coverage via a new `__tests__/domain/player.test.ts` — this commit intentionally leaves the consumer files referencing the removed `nickname` field, so the TypeScript build is red between commits. Commit 2 updates store, screen, and i18n locales together, restoring a green typecheck. There is no data migration; legacy JSON is read with a defensive fallback in `playerFromJson`.

**Tech Stack:** React Native + Expo, react-native-paper, Zustand, i18next, Jest, TypeScript (strict).

**Reference spec:** [docs/superpowers/specs/2026-05-12-player-name-required-design.md](../specs/2026-05-12-player-name-required-design.md)

---

## File Map

- Modify: `src/domain/models/player.ts` — rename `nickname` → `playerName` as required field; make `firstName` nullable; update all helpers and JSON readers/writers.
- Create: `__tests__/domain/player.test.ts` — covers helpers (`playerDisplayName`, `playerFullName`, `createPlayer`, `copyPlayer`, `playerToJson`, `playerFromJson`) including legacy fallback cases.
- Modify: `src/application/stores/playerListStore.ts` — `add()` input shape changes to `{ playerName, firstName?, lastName? }`.
- Modify: `src/presentation/screens/PlayerManagementScreen.tsx` — form state, validation, dialog field order, and list item description.
- Modify: `src/presentation/i18n/locales/de.ts` — rename / replace keys inside `players`.
- Modify: `src/presentation/i18n/locales/en.ts` — rename / replace keys inside `players`.

No other files touched. `playerRepository.ts` keeps working unchanged because it only calls public helpers. All other consumers (`TeamPicker`, `Scoreboard`, `NewSheetScreen`, `RoundSection`, `groupRankingCalculator`) reach players only through `playerDisplayName` / `playerFullName`, both of which remain exported under the same names.

---

## Task 1: Domain model — replace nickname with playerName

**Files:**
- Modify: `src/domain/models/player.ts`
- Create: `__tests__/domain/player.test.ts`

This commit alone breaks the TypeScript build for consumers; Task 2 closes that loop. The test file does NOT exercise the consumer files, so the new tests pass even while typecheck is red elsewhere.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/domain/player.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/domain/player.test.ts`
Expected: FAIL — `Player.playerName` does not exist, tests for the new behaviour fail to compile or run.

- [ ] **Step 3: Rewrite `src/domain/models/player.ts`**

Replace the full contents of `src/domain/models/player.ts` with:

```ts
import { newId } from '@/core/id';

/**
 * Ein Spieler — im app-weiten Spielerpool oder als Snapshot im Spielbogen.
 * Die ID ist stabil und wird in `Game` referenziert.
 *
 * `playerName` ist Pflicht und wird in der UI als "Spielername" angezeigt.
 * `firstName` und `lastName` sind optional.
 */
export interface Player {
  readonly id: string;
  readonly playerName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

export interface CreatePlayerInput {
  playerName: string;
  firstName?: string | null;
  lastName?: string | null;
}

export function createPlayer(input: CreatePlayerInput): Player {
  return {
    id: newId(),
    playerName: input.playerName.trim(),
    firstName: emptyToNull(input.firstName),
    lastName: emptyToNull(input.lastName),
  };
}

/** Anzeigename — der Spielername. */
export function playerDisplayName(p: Player): string {
  return p.playerName;
}

/** Vor- und Nachname zusammengesetzt; leerer String falls beide fehlen. */
export function playerFullName(p: Player): string {
  const first = p.firstName?.trim() ?? '';
  const last = p.lastName?.trim() ?? '';
  if (first === '' && last === '') return '';
  if (first === '') return last;
  if (last === '') return first;
  return `${first} ${last}`;
}

/**
 * Aktualisiert ausgewaehlte Felder. `null` in `firstName` / `lastName`
 * loescht das Feld; Auslassen behaelt den bisherigen Wert. `playerName`
 * kann nur ueberschrieben, nicht geloescht werden.
 */
export interface PlayerPatch {
  playerName?: string;
  /** Auslassen = behalten; `null` = loeschen; String = setzen. */
  firstName?: string | null;
  /** Auslassen = behalten; `null` = loeschen; String = setzen. */
  lastName?: string | null;
}

export function copyPlayer(p: Player, patch: PlayerPatch): Player {
  return {
    id: p.id,
    playerName: patch.playerName ?? p.playerName,
    firstName: 'firstName' in patch ? (patch.firstName ?? null) : p.firstName,
    lastName: 'lastName' in patch ? (patch.lastName ?? null) : p.lastName,
  };
}

export function playerToJson(p: Player): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id,
    playerName: p.playerName,
  };
  if (p.firstName !== null) out['firstName'] = p.firstName;
  if (p.lastName !== null) out['lastName'] = p.lastName;
  return out;
}

/**
 * Liest die aktuelle Form (`playerName` Pflicht). Defensives Lesen fuer
 * alte Daten: erst `nickname`-Key, dann Komposition aus firstName +
 * lastName, dann sehr alter Einzel-`name`-Key, sonst leerer String.
 */
export function playerFromJson(json: Record<string, unknown>): Player {
  const id = json['id'];
  if (typeof id !== 'string') {
    throw new Error('Player.id fehlt oder ist kein String');
  }
  const firstName =
    typeof json['firstName'] === 'string' ? (json['firstName'] as string) : null;
  const lastName =
    typeof json['lastName'] === 'string' ? (json['lastName'] as string) : null;
  const playerName = resolvePlayerName(json, firstName, lastName);
  return { id, playerName, firstName, lastName };
}

function resolvePlayerName(
  json: Record<string, unknown>,
  firstName: string | null,
  lastName: string | null,
): string {
  const direct = json['playerName'];
  if (typeof direct === 'string') return direct;
  const legacyNickname = json['nickname'];
  if (typeof legacyNickname === 'string') return legacyNickname;
  const parts = [firstName, lastName].filter(
    (s): s is string => s !== null && s !== '',
  );
  if (parts.length > 0) return parts.join(' ');
  const legacyName = json['name'];
  if (typeof legacyName === 'string') return legacyName;
  return '';
}

function emptyToNull(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t === '' ? null : t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/domain/player.test.ts`
Expected: PASS — all 20 tests in the new file are green.

- [ ] **Step 5: Run the full test suite to confirm no other domain test regressed**

Run: `npx jest --testPathIgnorePatterns="presentation"`
Expected: PASS for every non-presentation test. (We exclude presentation tests because `localesShape` will fail on the old vs new key set — that is expected and gets fixed in Task 2.) Domain, scoring, and data tests must all stay green.

- [ ] **Step 6: Commit**

```bash
git add src/domain/models/player.ts __tests__/domain/player.test.ts
git commit -m "feat(player): rename nickname to playerName and make it the required field"
```

The repo is intentionally in a "consumer typecheck red" state after this commit. Task 2 closes the loop.

---

## Task 2: Wire consumers — store, screen, i18n

**Files:**
- Modify: `src/application/stores/playerListStore.ts`
- Modify: `src/presentation/screens/PlayerManagementScreen.tsx`
- Modify: `src/presentation/i18n/locales/de.ts`
- Modify: `src/presentation/i18n/locales/en.ts`

- [ ] **Step 1: Update `playerListStore.ts`**

Replace the full contents of `src/application/stores/playerListStore.ts` with:

```ts
import { create } from 'zustand';

import {
  createPlayer,
  playerDisplayName,
  type Player,
} from '@/domain/models/player';
import { repositories } from '@/application/stores/repositories';

export interface PlayerListState {
  loading: boolean;
  players: ReadonlyArray<Player>;
  error: Error | null;
  refresh: () => Promise<void>;
  add: (input: {
    playerName: string;
    firstName?: string | null;
    lastName?: string | null;
  }) => Promise<Player>;
  update: (updated: Player) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function sortByDisplayName(players: ReadonlyArray<Player>): Player[] {
  return [...players].sort((a, b) =>
    playerDisplayName(a).toLowerCase().localeCompare(playerDisplayName(b).toLowerCase()),
  );
}

export const usePlayerListStore = create<PlayerListState>((set, get) => ({
  loading: true,
  players: [],
  error: null,

  async refresh() {
    set({ loading: true, error: null });
    try {
      const players = await repositories.player().loadAll();
      set({ loading: false, players, error: null });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  },

  async add(input) {
    const player = createPlayer(input);
    await repositories.player().save(player);
    set({ players: sortByDisplayName([...get().players, player]) });
    return player;
  },

  async update(updated) {
    await repositories.player().save(updated);
    const next = get().players.map((p) => (p.id === updated.id ? updated : p));
    set({ players: sortByDisplayName(next) });
  },

  async remove(id) {
    await repositories.player().delete(id);
    set({ players: get().players.filter((p) => p.id !== id) });
  },
}));
```

- [ ] **Step 2: Update `de.ts`**

In `src/presentation/i18n/locales/de.ts`, replace the entire `players` block:

```ts
players: {
  errorPlayerNameRequired: 'Spielername ist erforderlich',
  addFab: 'Spieler',
  editMenu: 'Bearbeiten',
  deleteMenu: 'Löschen',
  newTitle: 'Neuer Spieler',
  editTitle: 'Spieler bearbeiten',
  playerNameLabel: 'Spielername',
  firstNameLabel: 'Vorname (optional)',
  lastNameLabel: 'Nachname (optional)',
  createButton: 'Anlegen',
  saveButton: 'Speichern',
  deleteTitle: 'Spieler löschen?',
  deleteBody: '{{name}} wird aus der Spielerverwaltung entfernt. Bestehende Spielbögen bleiben unverändert.',
  emptyTitle: 'Noch keine Spieler',
  emptyHint: 'Tippe unten auf „Spieler", um den ersten Spieler anzulegen.',
},
```

Removed keys vs. previous version: `errorFirstNameRequired`, `errorLastNameRequired`, `nicknameLabel`. Added keys: `errorPlayerNameRequired`, `playerNameLabel`. Changed values: `firstNameLabel`, `lastNameLabel`.

- [ ] **Step 3: Update `en.ts`**

In `src/presentation/i18n/locales/en.ts`, replace the entire `players` block:

```ts
players: {
  errorPlayerNameRequired: 'Player name is required',
  addFab: 'Player',
  editMenu: 'Edit',
  deleteMenu: 'Delete',
  newTitle: 'New player',
  editTitle: 'Edit player',
  playerNameLabel: 'Player name',
  firstNameLabel: 'First name (optional)',
  lastNameLabel: 'Last name (optional)',
  createButton: 'Create',
  saveButton: 'Save',
  deleteTitle: 'Delete player?',
  deleteBody: '{{name}} will be removed from player management. Existing sheets stay unchanged.',
  emptyTitle: 'No players yet',
  emptyHint: 'Tap "Player" below to add your first player.',
},
```

- [ ] **Step 4: Update `PlayerManagementScreen.tsx`**

Replace the full contents of `src/presentation/screens/PlayerManagementScreen.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  Button,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  copyPlayer,
  playerDisplayName,
  playerFullName,
  type Player,
} from '@/domain/models/player';
import { usePlayerListStore } from '@/application/stores/playerListStore';
import { useTranslation } from '@/presentation/i18n/useTranslation';

interface FormState {
  playerName: string;
  firstName: string;
  lastName: string;
  playerNameError: string | null;
}

const emptyForm: FormState = {
  playerName: '',
  firstName: '',
  lastName: '',
  playerNameError: null,
};

export function PlayerManagementScreen() {
  const { t } = useTranslation();
  const loading = usePlayerListStore((s) => s.loading);
  const players = usePlayerListStore((s) => s.players);
  const error = usePlayerListStore((s) => s.error);
  const refresh = usePlayerListStore((s) => s.refresh);
  const add = usePlayerListStore((s) => s.add);
  const update = usePlayerListStore((s) => s.update);
  const remove = usePlayerListStore((s) => s.remove);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);

  const [menuForId, setMenuForId] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  }

  function openEdit(p: Player) {
    setEditing(p);
    setForm({
      playerName: p.playerName,
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      playerNameError: null,
    });
    setEditorOpen(true);
  }

  async function submit() {
    const playerName = form.playerName.trim();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const playerNameError =
      playerName === '' ? t('players.errorPlayerNameRequired') : null;
    if (playerNameError !== null) {
      setForm({ ...form, playerNameError });
      return;
    }
    const patch = {
      playerName,
      firstName: firstName === '' ? null : firstName,
      lastName: lastName === '' ? null : lastName,
    };
    if (editing === null) {
      await add(patch);
    } else {
      await update(copyPlayer(editing, patch));
    }
    setEditorOpen(false);
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <View style={{ flex: 1 }}>
      {loading && players.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="bodyMedium">{t('common.loading')}</Text>
        </View>
      ) : error !== null && players.length === 0 ? (
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <Text variant="bodyMedium">
            {t('common.errorLoading')}: {error.message}
          </Text>
        </View>
      ) : players.length === 0 ? (
        <EmptyView />
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 96 }}
          data={players}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)' }} />
          )}
          renderItem={({ item: p }) => {
            const fullName = playerFullName(p);
            return (
              <List.Item
                title={playerDisplayName(p)}
                description={fullName !== '' ? fullName : undefined}
                left={(props) => <List.Icon {...props} icon="account-outline" />}
                onPress={() => openEdit(p)}
                right={() => (
                  <Menu
                    visible={menuForId === p.id}
                    onDismiss={() => setMenuForId(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        onPress={() => setMenuForId(p.id)}
                      />
                    }
                  >
                    <Menu.Item
                      title={t('players.editMenu')}
                      onPress={() => {
                        setMenuForId(null);
                        openEdit(p);
                      }}
                    />
                    <Menu.Item
                      title={t('players.deleteMenu')}
                      onPress={() => {
                        setMenuForId(null);
                        setDeleteTarget(p);
                      }}
                    />
                  </Menu>
                )}
              />
            );
          }}
        />
      )}

      <FAB
        icon="account-plus"
        label={t('players.addFab')}
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPress={openNew}
      />

      <Portal>
        <Dialog visible={editorOpen} onDismiss={() => setEditorOpen(false)}>
          <Dialog.Title>
            {editing === null ? t('players.newTitle') : t('players.editTitle')}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('players.playerNameLabel')}
              value={form.playerName}
              onChangeText={(v) =>
                setForm({ ...form, playerName: v, playerNameError: null })
              }
              mode="outlined"
              autoFocus
              error={form.playerNameError !== null}
            />
            <HelperText type="error" visible={form.playerNameError !== null}>
              {form.playerNameError ?? ''}
            </HelperText>
            <TextInput
              label={t('players.firstNameLabel')}
              value={form.firstName}
              onChangeText={(v) => setForm({ ...form, firstName: v })}
              mode="outlined"
            />
            <TextInput
              label={t('players.lastNameLabel')}
              value={form.lastName}
              onChangeText={(v) => setForm({ ...form, lastName: v })}
              mode="outlined"
              onSubmitEditing={() => void submit()}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditorOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button mode="contained" onPress={() => void submit()}>
              {editing === null
                ? t('players.createButton')
                : t('players.saveButton')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={deleteTarget !== null}
          onDismiss={() => setDeleteTarget(null)}
        >
          <Dialog.Title>{t('players.deleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('players.deleteBody', {
                name: deleteTarget !== null ? playerDisplayName(deleteTarget) : '',
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button mode="contained-tonal" onPress={() => void confirmDelete()}>
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function EmptyView() {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flex: 1,
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <List.Icon icon="account-group-outline" />
      <Text variant="headlineSmall">{t('players.emptyTitle')}</Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        {t('players.emptyHint')}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: Run type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — all 100+ tests including the new `player.test.ts` and the existing `localesShape.test.ts`.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: 0 errors. Pre-existing warnings are unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/application/stores/playerListStore.ts src/presentation/screens/PlayerManagementScreen.tsx src/presentation/i18n/locales/de.ts src/presentation/i18n/locales/en.ts
git commit -m "feat(player): switch UI and store to playerName as the required field"
```

---

## Task 3: Manual browser sanity check

**Files:** none — interaction-level verification.

- [ ] **Step 1: Start the dev server**

Run: `npm run web`
Expected: Expo dev server starts and prints a local URL.

- [ ] **Step 2: Open Player Management**

1. Navigate to the player management screen.
2. Tap the "Spieler" FAB.
3. Verify the dialog shows three fields in this order: **Spielername** (focused, no "(optional)" suffix), **Vorname (optional)**, **Nachname (optional)**.

- [ ] **Step 3: Validation paths**

1. Leave Spielername empty, tap "Anlegen". Expected: red error "Spielername ist erforderlich" under the field; dialog stays open.
2. Type something in Spielername (e.g. "Otto"), leave Vor- and Nachname empty, tap "Anlegen". Expected: dialog closes; new entry "Otto" appears in the list with no description text below it.
3. Open the editor on "Otto". Type a Vorname only ("Ottokar"). Save. Expected: list shows title "Otto" with description "Ottokar" (subtitle).
4. Open the editor again, add a Nachname ("Meier"). Save. Expected: list shows title "Otto" with description "Ottokar Meier".
5. Edit again, clear Vorname and Nachname (leave only Spielername). Save. Expected: no description, just "Otto".

- [ ] **Step 4: Sprache wechseln**

In Settings, switch language to English and revisit the dialog. Expected: labels read **Player name**, **First name (optional)**, **Last name (optional)**; error text reads "Player name is required".

- [ ] **Step 5: Legacy data smoke check (optional, if local data exists)**

If you have an existing local sheet from before this change, open it. Expected: existing players still display sensible names via the defensive `playerFromJson` fallback (former `nickname` shown as Spielername; or, if no nickname existed, a synthesised `firstName + lastName` is used as Spielername).

---

## Self-Review Notes

- **Spec coverage:** Domain model + helpers (Task 1), store input shape (Task 2 Step 1), UI form / validation / list (Task 2 Step 4), i18n DE/EN (Task 2 Steps 2–3), tests including legacy fallbacks (Task 1 Step 1). Out-of-scope items (consumer screens, repository, migration) are explicitly untouched.
- **No placeholders:** every code step contains complete code.
- **Type consistency:** `Player.playerName: string` (Task 1) is consumed unchanged in Task 2 store input, form state, and UI text inputs. `CreatePlayerInput` shape matches what `playerListStore.add()` accepts. `PlayerPatch` matches what `copyPlayer` accepts and what the UI builds. `playerDisplayName(p)` / `playerFullName(p)` keep their existing signatures, so non-player-management consumers stay unaffected.
- **Intentional intermediate red state:** Task 1's commit deliberately breaks consumer TypeScript. The plan calls out an exclusion in Task 1 Step 5 (`--testPathIgnorePatterns="presentation"`) so domain/scoring/data tests can still be verified between commits without the i18n key drift bringing the full suite down. Task 2 closes the loop with a green typecheck, test suite, and lint.
