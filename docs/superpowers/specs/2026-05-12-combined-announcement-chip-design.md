# Combined "Ansagen" chip per party

## Goal

In `AddGameScreen`, replace the two separate controls per party
(the pinned `reAnnounced` / `contraAnnounced` `FlagChip` and the
"Stufe angesagt"-Zyklus-Chip below it) with a **single cycling chip**
per party that walks through six states.

## Behaviour

Each party (Re, Kontra) gets one "Ansagen" chip. Each click advances
to the next state; after the last state it wraps back to "keine Ansage".

| Click | Re label          | Kontra label          | Selected flags                                                                  |
|------:|-------------------|-----------------------|---------------------------------------------------------------------------------|
| 0     | keine Ansage      | keine Ansage          | —                                                                               |
| 1     | Re angesagt +2    | Kontra angesagt +2    | `reAnnounced` / `contraAnnounced`                                               |
| 2     | Unter 90 +3       | Unter 90 +3           | + `…AnnouncedUnder90`                                                           |
| 3     | Unter 60 +4       | Unter 60 +4           | + `…AnnouncedUnder60`                                                           |
| 4     | Unter 30 +5       | Unter 30 +5           | + `…AnnouncedUnder30`                                                           |
| 5     | Schwarz +6        | Schwarz +6            | + `…AnnouncedSchwarz`                                                           |

The `+N` numbers are cumulative game-value contributions. They line up
with the existing flag values (`reAnnounced` = 2, every level-announcement
flag = 1) without any scoring change.

The global "Stufe"-Chip at the top of the screen (currently lines 390–394
in `AddGameScreen.tsx`) is **out of scope** — it reflects the *played*
levels and stays unchanged.

## Implementation

### `src/presentation/screens/addGame/flagSpecs.ts`

Extend the existing announcement-code arrays so the base announcement
flag sits at index 0:

```ts
export const reAnnouncementCodes: ReadonlyArray<string> = [
  reAnnounced.code,
  reAnnouncedUnder90.code,
  reAnnouncedUnder60.code,
  reAnnouncedUnder30.code,
  reAnnouncedSchwarz.code,
];

export const contraAnnouncementCodes: ReadonlyArray<string> = [
  contraAnnounced.code,
  contraAnnouncedUnder90.code,
  contraAnnouncedUnder60.code,
  contraAnnouncedUnder30.code,
  contraAnnouncedSchwarz.code,
];
```

Add the necessary imports (`reAnnounced`, `contraAnnounced`).

The existing `cycleAnnouncement` / `announcementCount` logic in
`AddGameScreen.tsx` continues to work as-is — it just cycles through
five steps instead of four.

`counterCodes` in `AddGameScreen.tsx` builds on these arrays, so the base
announcement codes are automatically excluded from `flagsByGroup(...)` —
the standalone `FlagChip` for `reAnnounced` / `contraAnnounced` disappears
from the UI without any further filter change.

### `src/presentation/screens/AddGameScreen.tsx`

1. Replace `buildAnnouncementChipLabel(count: number)` with a version that
   takes the party as well, returning labels for the six states defined
   above. The label for `count === 1` is party-specific
   ("Re angesagt +2" vs. "Kontra angesagt +2"); for `count >= 2` both
   parties use the same wording ("Unter 90 +3", …, "Schwarz +6").

2. Drop the `pinnedFlagCode` and `belowPinnedFlag` props from
   `FlagGroupSection` and remove the associated logic from its body
   (the pinning machinery is no longer used by anyone).

3. In each party column, render the new "Ansagen" chip directly between
   the section heading (`addGame.rePoints` / `addGame.kontraPoints`) and
   the wrapped flag row produced by `FlagGroupSection`. The chip
   shows `selected={announcementCount(side) > 0}` and toggles via
   `cycleAnnouncement(side)`, identical to today's API.

### i18n keys

Replace the existing announcement-related keys with the six-state set:

```ts
addGame: {
  // …
  announcementChip: {
    none:       'keine Ansage',
    reBase:     'Re angesagt +{{count}}',
    contraBase: 'Kontra angesagt +{{count}}',
    under90:    'Unter 90 +{{count}}',
    under60:    'Unter 60 +{{count}}',
    under30:    'Unter 30 +{{count}}',
    schwarz:    'Schwarz +{{count}}',
  },
  // …
}
```

Remove the now-unused keys:
- `addGame.noLevelAnnounced`
- `addGame.announcementChip_one`
- `addGame.announcementChip_two`
- `addGame.announcementChip_three`
- `addGame.announcementChip_many`

Apply analogous edits to `en.ts`.

## Legacy data

No special handling. In practice, a saved game that has a level
announcement flag set without its base announcement flag does not occur,
because the existing UI always paired the two. If such a state ever did
exist, the new chip would label it by raw count; clicking the chip
normalises the state.

## Out of scope

- The global "Stufe"-Chip (played-level cycle) at the top of the screen.
- Any scoring change — game-value calculations stay identical.
- Migration of stored sheets.
