# Combined Announcement Chip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two separate per-party controls in `AddGameScreen` (pinned `reAnnounced`/`contraAnnounced` chip + level-announcement cycle chip) with a single six-state "Ansagen" chip per party.

**Architecture:** Extend the existing `reAnnouncementCodes` / `contraAnnouncementCodes` arrays in `flagSpecs.ts` to include the base announcement at index 0 (the existing `cycleAnnouncement` / `announcementCount` logic in `AddGameScreen.tsx` keeps working unchanged). Introduce a pure label-spec helper for the six chip states and unit-test it. Drop the pinned-flag machinery in `FlagGroupSection` and render the combined chip directly in each party column.

**Tech Stack:** React Native, react-native-paper (Chip), Zustand store, i18next, Jest.

**Reference spec:** [docs/superpowers/specs/2026-05-12-combined-announcement-chip-design.md](../specs/2026-05-12-combined-announcement-chip-design.md)

---

## File Map

- Modify: `src/presentation/screens/addGame/flagSpecs.ts` — extend arrays, add pure `announcementLabel(count, side)` helper.
- Modify: `src/presentation/screens/AddGameScreen.tsx` — wire helper into the chip, remove pinned-flag mechanism, render single chip per party.
- Modify: `src/presentation/i18n/locales/de.ts` — add `addGame.announcementChip.*` keys, remove obsolete keys.
- Modify: `src/presentation/i18n/locales/en.ts` — same as DE, mirror keys.
- Create: `__tests__/presentation/addGame/announcementCycle.test.ts` — unit test for `announcementLabel`.

---

## Task 1: Pure announcement label helper + extended code arrays

**Files:**
- Modify: `src/presentation/screens/addGame/flagSpecs.ts`
- Create: `__tests__/presentation/addGame/announcementCycle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/presentation/addGame/announcementCycle.test.ts`:

```ts
import {
  announcementLabel,
  reAnnouncementCodes,
  contraAnnouncementCodes,
} from '@/presentation/screens/addGame/flagSpecs';
import {
  reAnnounced,
  reAnnouncedSchwarz,
  reAnnouncedUnder30,
  reAnnouncedUnder60,
  reAnnouncedUnder90,
  contraAnnounced,
  contraAnnouncedSchwarz,
  contraAnnouncedUnder30,
  contraAnnouncedUnder60,
  contraAnnouncedUnder90,
} from '@/domain/scoring/scoringRules';

describe('flagSpecs announcement cycle', () => {
  test('reAnnouncementCodes startet mit reAnnounced gefolgt von den Stufen', () => {
    expect(reAnnouncementCodes).toEqual([
      reAnnounced.code,
      reAnnouncedUnder90.code,
      reAnnouncedUnder60.code,
      reAnnouncedUnder30.code,
      reAnnouncedSchwarz.code,
    ]);
  });

  test('contraAnnouncementCodes startet mit contraAnnounced gefolgt von den Stufen', () => {
    expect(contraAnnouncementCodes).toEqual([
      contraAnnounced.code,
      contraAnnouncedUnder90.code,
      contraAnnouncedUnder60.code,
      contraAnnouncedUnder30.code,
      contraAnnouncedSchwarz.code,
    ]);
  });
});

describe('announcementLabel', () => {
  test('count 0 -> none-Key, count 0', () => {
    expect(announcementLabel(0, 're')).toEqual({
      key: 'addGame.announcementChip.none',
      count: 0,
    });
    expect(announcementLabel(0, 'contra')).toEqual({
      key: 'addGame.announcementChip.none',
      count: 0,
    });
  });

  test('count 1 -> seitenspezifischer Basis-Key, count 2', () => {
    expect(announcementLabel(1, 're')).toEqual({
      key: 'addGame.announcementChip.reBase',
      count: 2,
    });
    expect(announcementLabel(1, 'contra')).toEqual({
      key: 'addGame.announcementChip.contraBase',
      count: 2,
    });
  });

  test('count 2 -> under90, count 3', () => {
    expect(announcementLabel(2, 're')).toEqual({
      key: 'addGame.announcementChip.under90',
      count: 3,
    });
    expect(announcementLabel(2, 'contra')).toEqual({
      key: 'addGame.announcementChip.under90',
      count: 3,
    });
  });

  test('count 3 -> under60, count 4', () => {
    expect(announcementLabel(3, 're')).toEqual({
      key: 'addGame.announcementChip.under60',
      count: 4,
    });
  });

  test('count 4 -> under30, count 5', () => {
    expect(announcementLabel(4, 're')).toEqual({
      key: 'addGame.announcementChip.under30',
      count: 5,
    });
  });

  test('count 5 -> schwarz, count 6', () => {
    expect(announcementLabel(5, 're')).toEqual({
      key: 'addGame.announcementChip.schwarz',
      count: 6,
    });
    expect(announcementLabel(5, 'contra')).toEqual({
      key: 'addGame.announcementChip.schwarz',
      count: 6,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/presentation/addGame/announcementCycle.test.ts`
Expected: FAIL — either `announcementLabel` is not exported from `flagSpecs.ts`, or the array contents don't match.

- [ ] **Step 3: Update `flagSpecs.ts`**

Add the new imports at the top (next to the existing ones):

```ts
import {
  contraAnnounced,
  contraAnnouncedSchwarz,
  contraAnnouncedUnder30,
  contraAnnouncedUnder60,
  contraAnnouncedUnder90,
  contraDoppelkopf1,
  contraDoppelkopf2,
  contraDoppelkopf3,
  contraDoppelkopf4,
  contraFuchs1,
  contraFuchs2,
  reAnnounced,
  reAnnouncedSchwarz,
  reAnnouncedUnder30,
  reAnnouncedUnder60,
  reAnnouncedUnder90,
  reDoppelkopf1,
  reDoppelkopf2,
  reDoppelkopf3,
  reDoppelkopf4,
  reFuchs1,
  reFuchs2,
  schwarz,
  under30,
  under60,
  under90,
} from '@/domain/scoring/scoringRules';
```

Replace the existing `reAnnouncementCodes` and `contraAnnouncementCodes` definitions:

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

Append at the end of `flagSpecs.ts`:

```ts
export type AnnouncementSide = 're' | 'contra';

export interface AnnouncementLabelSpec {
  /** i18n key to feed into t(). */
  key: string;
  /** Cumulative game-value count used in the label, 0 when none. */
  count: number;
}

/**
 * Liefert i18n-Key und kumulierten Spielwert-Beitrag fuer den Zyklus-Chip
 * der Ansagen (0..5). 0 = keine Ansage, 1 = nur Re/Kontra angesagt (+2),
 * 2..5 = zusaetzlich Unter 90/60/30/Schwarz (+3..+6).
 */
export function announcementLabel(
  count: number,
  side: AnnouncementSide,
): AnnouncementLabelSpec {
  if (count <= 0) return { key: 'addGame.announcementChip.none', count: 0 };
  const cumulative = count + 1;
  switch (count) {
    case 1:
      return {
        key:
          side === 're'
            ? 'addGame.announcementChip.reBase'
            : 'addGame.announcementChip.contraBase',
        count: cumulative,
      };
    case 2:
      return { key: 'addGame.announcementChip.under90', count: cumulative };
    case 3:
      return { key: 'addGame.announcementChip.under60', count: cumulative };
    case 4:
      return { key: 'addGame.announcementChip.under30', count: cumulative };
    default:
      return { key: 'addGame.announcementChip.schwarz', count: cumulative };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/presentation/addGame/announcementCycle.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/presentation/screens/addGame/flagSpecs.ts __tests__/presentation/addGame/announcementCycle.test.ts
git commit -m "feat(addGame): extend announcement code arrays and add label helper"
```

---

## Task 2: i18n keys (DE + EN)

**Files:**
- Modify: `src/presentation/i18n/locales/de.ts` (within `addGame: { … }`)
- Modify: `src/presentation/i18n/locales/en.ts` (within `addGame: { … }`)

This task is locked together by the existing `__tests__/presentation/i18n/localesShape.test.ts` — DE and EN must have the same key set, so both files must change in the same step.

- [ ] **Step 1: Remove obsolete keys in `de.ts`**

In `src/presentation/i18n/locales/de.ts`, inside the `addGame` block, remove these five lines:

```ts
noLevelAnnounced: 'keine Stufe angesagt',
announcementChip_one: 'Unter 90 angesagt +{{count}}',
announcementChip_two: 'Unter 60 angesagt +{{count}}',
announcementChip_three: 'Unter 30 angesagt +{{count}}',
announcementChip_many: 'Schwarz angesagt +{{count}}',
```

- [ ] **Step 2: Add new `announcementChip` block in `de.ts`**

Insert in the same `addGame` block (after `kontraPoints`, before `previewSoloValue`):

```ts
announcementChip: {
  none: 'keine Ansage',
  reBase: 'Re angesagt +{{count}}',
  contraBase: 'Kontra angesagt +{{count}}',
  under90: 'Unter 90 +{{count}}',
  under60: 'Unter 60 +{{count}}',
  under30: 'Unter 30 +{{count}}',
  schwarz: 'Schwarz +{{count}}',
},
```

- [ ] **Step 3: Mirror in `en.ts`**

In `src/presentation/i18n/locales/en.ts`, inside the `addGame` block, remove the same five obsolete keys and insert:

```ts
announcementChip: {
  none: 'no announcement',
  reBase: 'Re announced +{{count}}',
  contraBase: 'Kontra announced +{{count}}',
  under90: 'Unter 90 +{{count}}',
  under60: 'Unter 60 +{{count}}',
  under30: 'Unter 30 +{{count}}',
  schwarz: 'Schwarz +{{count}}',
},
```

- [ ] **Step 4: Run locales-shape test**

Run: `npx jest __tests__/presentation/i18n/localesShape.test.ts`
Expected: PASS — DE and EN now share the same key set.

- [ ] **Step 5: Run type-check**

Run: `npm run typecheck`
Expected: PASS — note that `AddGameScreen.tsx` still references the removed keys; this will be addressed in Task 3. **Skip this step here — typecheck will be run together with the next task to avoid an intermediate red state.**

- [ ] **Step 6: Stage but do not commit yet**

Hold the i18n changes uncommitted; they ship together with the `AddGameScreen.tsx` rewrite in Task 3 so the working tree never has a half-wired state. Verify staged set:

```bash
git status -s
```

Expected: `M src/presentation/i18n/locales/de.ts` and `M src/presentation/i18n/locales/en.ts` shown as modified (unstaged or staged — both fine).

---

## Task 3: Single combined "Ansagen" chip in AddGameScreen.tsx

**Files:**
- Modify: `src/presentation/screens/AddGameScreen.tsx`

- [ ] **Step 1: Update imports**

In `src/presentation/screens/AddGameScreen.tsx`:

1. From `@/domain/scoring/scoringRules`, the named imports `reAnnounced` and `contraAnnounced` are no longer used directly. Remove them from the import list:

```ts
import { selectableFlags } from '@/domain/scoring/scoringRules';
```

(Keep this import statement; just drop the `contraAnnounced` and `reAnnounced` names. `selectableFlags` is still used.)

2. From `@/presentation/screens/addGame/flagSpecs`, add `announcementLabel` and `AnnouncementSide`:

```ts
import {
  announcementLabel,
  contraAnnouncementCodes,
  doppelkopfSpec,
  fuchsSpec,
  levelCodes,
  reAnnouncementCodes,
  stepsPerSide,
  type AnnouncementSide,
  type StackingCounterSpec,
} from '@/presentation/screens/addGame/flagSpecs';
```

- [ ] **Step 2: Replace `buildAnnouncementChipLabel`**

In the `Loaded` component, delete the old `buildAnnouncementChipLabel` function (currently around lines 104–110) and replace it with:

```ts
function buildAnnouncementChipLabel(count: number, side: AnnouncementSide): string {
  const spec = announcementLabel(count, side);
  return t(spec.key, { count: spec.count });
}
```

- [ ] **Step 3: Drop the pinned-flag mechanism from `FlagGroupSection`**

Replace the `FlagGroupSectionProps` interface and the `FlagGroupSection` function body (currently lines 526–572) with:

```ts
interface FlagGroupSectionProps {
  flags: ReadonlyArray<ScoreFlag>;
  selected: ReadonlySet<string>;
  onToggle: (f: ScoreFlag, selected: boolean) => void;
  displayedValue: (f: ScoreFlag) => number;
  trailingChips?: ReadonlyArray<React.ReactNode>;
}

function FlagGroupSection({
  flags,
  selected,
  onToggle,
  displayedValue,
  trailingChips,
}: FlagGroupSectionProps) {
  function chipFor(f: ScoreFlag) {
    return (
      <FlagChip
        key={f.code}
        flag={f}
        selected={selected.has(f.code)}
        displayedValue={displayedValue(f)}
        enabled={!isFlagBlockedByConflict(f, selected)}
        onChanged={(sel) => onToggle(f, sel)}
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {flags.map((f) => chipFor(f))}
      {trailingChips}
    </View>
  );
}
```

- [ ] **Step 4: Render the combined chip in each party column**

In the rendered JSX, the two party columns currently look like this (lines ~396–470):

```tsx
<View style={{ flex: 1, gap: 6 }}>
  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
    {t('addGame.rePoints')}
  </Text>
  <FlagGroupSection
    flags={flagsByGroup(FlagGroup.reParty)}
    selected={selectedFlags}
    onToggle={onFlagToggled}
    displayedValue={displayedValue}
    pinnedFlagCode={reAnnounced.code}
    belowPinnedFlag={...}
    trailingChips={[...]}
  />
</View>
```

Replace the Re column with:

```tsx
<View style={{ flex: 1, gap: 6 }}>
  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
    {t('addGame.rePoints')}
  </Text>
  <View style={{ alignSelf: 'flex-start' }}>
    <Chip
      selected={announcementCount(true) > 0}
      showSelectedCheck={false}
      onPress={() => cycleAnnouncement(true)}
    >
      {buildAnnouncementChipLabel(announcementCount(true), 're')}
    </Chip>
  </View>
  <FlagGroupSection
    flags={flagsByGroup(FlagGroup.reParty)}
    selected={selectedFlags}
    onToggle={onFlagToggled}
    displayedValue={displayedValue}
    trailingChips={[
      <StackingCounterChip
        key="reFuchs"
        label={t(fuchsSpec.labelKey)}
        count={stackingCount(fuchsSpec, true)}
        sign={winner === WinnerSide.re ? 1 : -1}
        onTap={() => cycleStacking(fuchsSpec, true)}
      />,
      <StackingCounterChip
        key="reDoko"
        label={t(doppelkopfSpec.labelKey)}
        count={stackingCount(doppelkopfSpec, true)}
        sign={winner === WinnerSide.re ? 1 : -1}
        onTap={() => cycleStacking(doppelkopfSpec, true)}
      />,
    ]}
  />
</View>
```

Replace the Kontra column with:

```tsx
<View style={{ flex: 1, gap: 6 }}>
  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
    {t('addGame.kontraPoints')}
  </Text>
  <View style={{ alignSelf: 'flex-start' }}>
    <Chip
      selected={announcementCount(false) > 0}
      showSelectedCheck={false}
      onPress={() => cycleAnnouncement(false)}
    >
      {buildAnnouncementChipLabel(announcementCount(false), 'contra')}
    </Chip>
  </View>
  <FlagGroupSection
    flags={flagsByGroup(FlagGroup.contraParty)}
    selected={selectedFlags}
    onToggle={onFlagToggled}
    displayedValue={displayedValue}
    trailingChips={[
      <StackingCounterChip
        key="contraFuchs"
        label={t(fuchsSpec.labelKey)}
        count={stackingCount(fuchsSpec, false)}
        sign={winner === WinnerSide.contra ? 1 : -1}
        onTap={() => cycleStacking(fuchsSpec, false)}
      />,
      <StackingCounterChip
        key="contraDoko"
        label={t(doppelkopfSpec.labelKey)}
        count={stackingCount(doppelkopfSpec, false)}
        sign={winner === WinnerSide.contra ? 1 : -1}
        onTap={() => cycleStacking(doppelkopfSpec, false)}
      />,
    ]}
  />
</View>
```

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: PASS — no references to removed i18n keys, no references to removed `reAnnounced`/`contraAnnounced`, no references to removed props.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — including `announcementCycle.test.ts` (Task 1) and `localesShape.test.ts` (catches any DE/EN key drift from Task 2).

- [ ] **Step 7: Commit both Task 2 and Task 3 changes together**

```bash
git add src/presentation/i18n/locales/de.ts src/presentation/i18n/locales/en.ts src/presentation/screens/AddGameScreen.tsx
git commit -m "feat(addGame): merge announcement and level-cycle into single chip per party"
```

---

## Task 4: Manual sanity check

**Files:** none — interaction-level verification.

- [ ] **Step 1: Start the dev server**

Run: `npm run web`
Expected: Expo dev server starts and prints a local URL.

- [ ] **Step 2: Open AddGameScreen and click the new chip**

1. Open an existing sheet (or create one), tap "Neues Spiel".
2. Locate the Re-Partei column. Verify the section now shows: heading "Punkte der Re-Partei", a single chip labelled "keine Ansage", then the flag row + Fuchs/Doppelkopf counters.
3. Tap the chip six times. Expected labels in order:
   - "Re angesagt +2"
   - "Unter 90 +3"
   - "Unter 60 +4"
   - "Unter 30 +5"
   - "Schwarz +6"
   - back to "keine Ansage"
4. Repeat for the Kontra-Partei column; expected first label after one tap is "Kontra angesagt +2".
5. Confirm the *Spielwert*-preview card updates correctly (e.g. with Re-Sieger and the Re chip at "Schwarz +6", value is at least +6 above the unannotated baseline).
6. Confirm the global "Stufe"-Chip above the party columns still functions exactly as before.

- [ ] **Step 3: Switch language to English and re-check labels**

In Settings, set language to English. Reopen AddGame. Expected first chip label is "no announcement"; after one click "Re announced +2" / "Kontra announced +2"; further clicks "Unter 90 +3", … "Schwarz +6" (these stay German on purpose — they are Doppelkopf terminology).

- [ ] **Step 4: Edit an existing game**

Pick an older game from the sheet that was created with the previous UI. Open Edit. Expected: the chip reflects the previously-selected announcement state without crash; saving the game preserves the score.

---

## Self-Review Notes

- Spec coverage: extended arrays (Task 1), label helper (Task 1), pinned-flag removal (Task 3), single chip per party (Task 3), i18n keys (Task 2). Out-of-scope items (global Stufe chip, scoring) are untouched by design.
- No placeholders.
- Type consistency: `AnnouncementSide` is defined in `flagSpecs.ts` (Task 1) and consumed by `AddGameScreen.tsx` (Task 3). `announcementLabel` returns `{ key, count }`, both consumed correctly. Removed props (`pinnedFlagCode`, `belowPinnedFlag`) are dropped from interface and call sites together.
