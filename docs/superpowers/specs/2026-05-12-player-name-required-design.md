# Player name as the required identity field

## Goal

Swap the player-record's required field from the legacy "first name +
last name" pair to a single, mandatory **player name** ("Spielername"
in the UI). Real names become optional.

## Field semantics after change

| Field        | Type             | Required | UI label DE                | UI label EN                |
|--------------|------------------|----------|----------------------------|----------------------------|
| `playerName` | `string`         | yes      | `Spielername`              | `Player name`              |
| `firstName`  | `string \| null` | no       | `Vorname (optional)`       | `First name (optional)`    |
| `lastName`   | `string \| null` | no       | `Nachname (optional)`      | `Last name (optional)`     |

`playerName` is the new name of the field. The old name `nickname` is
gone from the codebase (interface, JSON, repository, store, UI). The old
JSON key `nickname` is still tolerated when reading legacy entries (see
below); nothing in the codebase keeps writing it.

## Domain model — `src/domain/models/player.ts`

```ts
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

export interface PlayerPatch {
  playerName?: string;
  firstName?: string | null;
  lastName?: string | null;
}
```

Helpers:

- `createPlayer(input)` — trims `playerName`; converts blank
  `firstName` / `lastName` to `null` via the existing `emptyToNull`.
- `copyPlayer(p, patch)` — `playerName` follows the existing
  "key-present-overrides" pattern but cannot be set to `null`. For
  `firstName` / `lastName`, `null` clears, omission keeps.
- `playerDisplayName(p)` → `return p.playerName`. The previous
  fallback chain is no longer needed because the field is required.
- `playerFullName(p)` → returns `firstName`, `lastName`, or
  `'<firstName> <lastName>'` depending on which sides are non-empty;
  returns `''` when both are empty/`null`.
- `playerToJson(p)` → always writes `playerName`; writes `firstName`
  / `lastName` only when non-null. The legacy `nickname` key is never
  written from this codebase again.
- `playerFromJson(json)` — see defensive read pattern below.

## Defensive read pattern in `playerFromJson`

The plan does not include a one-shot migration. To keep existing local
data legible, the JSON reader synthesises `playerName` from legacy
fields if absent:

1. If `json.playerName` is a string → use it.
2. Else if `json.nickname` is a string → use it.
3. Else build `'<firstName> <lastName>'.trim()` from whatever names
   are present in the legacy JSON.
4. If nothing is available → empty string `''`.

`firstName` / `lastName` are then read with the existing
`typeof === 'string' ? value : null` pattern. The very old fallback
that reads `json.name` (single field) stays in place.

## Store — `src/application/stores/playerListStore.ts`

`PlayerListState.add` input type changes to:

```ts
add: (input: {
  playerName: string;
  firstName?: string | null;
  lastName?: string | null;
}) => Promise<Player>;
```

The body forwards through `createPlayer` unchanged in spirit.

## UI — `src/presentation/screens/PlayerManagementScreen.tsx`

Form state:

```ts
interface FormState {
  playerName: string;
  firstName: string;
  lastName: string;
  playerNameError: string | null;
}
```

The editor dialog renders fields in this order:

1. **Player name** — `autoFocus`, single required field, error binding
   on `playerNameError`.
2. **First name** — optional, no error binding.
3. **Last name** — optional, no error binding,
   `onSubmitEditing` triggers `submit()` (keeps the existing
   keyboard-flow shortcut on the last field).

`submit()` validates only `playerName.trim() === ''`. The previous
two-field validation block is gone.

`renderItem` in the player list:

- Title stays `playerDisplayName(p)` (= `playerName`).
- Description = `playerFullName(p)` when non-empty; otherwise the
  description is not rendered. The previous `hasNickname` check
  becomes a plain `playerFullName(p) !== ''` test.

## i18n — `de.ts` / `en.ts`

In the `players` block:

- Remove keys: `nicknameLabel`, `errorFirstNameRequired`,
  `errorLastNameRequired`.
- Replace values:
  - `firstNameLabel`: `Vorname (optional)` / `First name (optional)`
  - `lastNameLabel`: `Nachname (optional)` / `Last name (optional)`
- Add keys (both locales):
  - `playerNameLabel`: `Spielername` / `Player name`
  - `errorPlayerNameRequired`: `Spielername ist erforderlich` /
    `Player name is required`

`__tests__/presentation/i18n/localesShape.test.ts` enforces parity
automatically.

## Tests

New file `__tests__/domain/player.test.ts` covers:

- `playerDisplayName` returns `playerName`.
- `playerFullName`:
  - both names present → `'first last'`.
  - only first → `'first'`.
  - only last → `'last'`.
  - both null/empty → `''`.
- `playerFromJson`:
  - new schema (`playerName` present) → reads directly.
  - legacy `nickname` schema → uses `nickname` value as `playerName`.
  - neither `playerName` nor `nickname` but `firstName`+`lastName`
    → synthesises `'first last'`.
  - very old schema with only `name` → uses `name` as `playerName`.
  - empty JSON object (only `id`) → `playerName: ''`.
- `playerToJson`:
  - writes `playerName`, includes `firstName`/`lastName` only when
    non-null.
  - never writes a `nickname` key.

## Out of scope

- Renaming `playerDisplayName` / `playerFullName` to anything more
  semantic — would churn five+ consumer files for cosmetic gain.
- Active data migration (per user instruction). The defensive read
  pattern above is the only legacy concession.
- Touching any non-player code path. All callers of
  `playerDisplayName` / `playerFullName` in `TeamPicker`,
  `Scoreboard`, `NewSheetScreen`, `RoundSection`,
  `groupRankingCalculator`, `playerRepository` remain unchanged.
