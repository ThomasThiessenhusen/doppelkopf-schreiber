# Ersatzspieler in der Saisonwertung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro Spielbogen "Gast vertritt Stammspieler" erfassen; die Saison-Rangliste der Platzierungspunkte kann die Punkte des Gastes zusaetzlich dem Stammspieler gutschreiben (Schalter, Default an).

**Architecture:** Neues Feld `GameSheet.substitutions` (rueckwaertskompatibles JSON). `calculateGroupRankings` bekommt `applySubstitutions`. Alle Stellen, die Spieler-IDs eines Bogens einsammeln (Player-Usage, Export, Import), beruecksichtigen zusaetzlich die Stammspieler-IDs. UI: Dialog im Spielbogen-Menue, Schalter im Ranking-Screen.

**Tech Stack:** TypeScript strict, Jest, Zustand, React Native Paper, i18next (`src/presentation/i18n/locales/de.ts` / `en.ts`).

**Spec:** [docs/superpowers/specs/2026-11-17-substitute-player-design.md](../specs/2026-11-17-substitute-player-design.md)

## Global Constraints

- Nur Platzierungspunkte werden uebertragen; `totalPoints` und `wonSoli` sind in beiden Schalterstellungen identisch.
- Schalter an: Stammspieler bekommt die Punkte **zusaetzlich**, Gast behaelt seine eigenen.
- Schalter im Ranking-Screen: Default **an**, nicht persistiert.
- Gueltigkeit: `substituteId` ∈ `sheet.playerIds`; `mainPlayerId` ∉ `sheet.playerIds`; jeder Gast und jeder Stammspieler hoechstens einmal pro Bogen.
- Alte Bogen-JSONs ohne `substitutions` laden als `[]`.
- Neue UI-Texte in `de.ts` **und** `en.ts` (Test `localesShape` erzwingt gleiche Keys).
- Keine neuen Dependencies, kein nativer Code — Android und iOS unberuehrt.
- Vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test`.

## Review Focus

1. Stammspieler, der in der Saison **keinen eigenen Bogen** gespielt hat — muss in der Platzierungsliste mit Namen (aus dem Pool) erscheinen, nicht mit ID. → Test in Task 2.
2. Ungueltige Daten im JSON (Stammspieler spielt selbst auf dem Bogen mit, Gast nicht im Bogen, Duplikate) — Calculator darf nichts doppelt gutschreiben, Laden darf nicht crashen. → Tests in Task 1 und Task 2.
3. Gast hat auf dem Bogen kein einziges Spiel (nicht in `activeIds`) — keine Punkte, kein Crash. → Test in Task 2.
4. Import, bei dem der Stammspieler als Spieler uebersprungen wird — Bogen wird trotzdem importiert, nur das Vertretungspaar faellt weg. → Test in Task 3.
5. Spieler-Pool: Stammspieler einer Vertretung darf nicht geloescht werden (sonst Rangliste mit nackter ID). → Test in Task 3.

---

### Task 1: Datenmodell `substitutions` am Spielbogen

**Files:**
- Create: `src/domain/models/substitution.ts`
- Modify: `src/domain/models/gameSheet.ts` (Interface, `createGameSheet`, `GameSheetPatch`, `copyGameSheet`, `gameSheetToJson`, `gameSheetFromJson`)
- Modify: alle GameSheet-Literale, die sonst nicht mehr kompilieren — `substitutions: []` ergaenzen: `src/application/stores/sheetStore.ts`, `src/presentation/screens/NewSheetScreen.tsx` (falls dort ein Literal entsteht), sowie die Test-Helfer in `__tests__/application/{exportService,importApply,importDiff,importParser,playerUsage,sheetHtml}.test.ts`, `__tests__/data/{gameSheetRepository,v2PoolReference}.test.ts`, `__tests__/domain/gameSheet.test.ts`, `__tests__/integration/exportImportRoundtrip.test.ts`, `__tests__/scoring/groupRankingCalculator.test.ts` (`npm run typecheck` zeigt die Liste)
- Test: `__tests__/domain/substitution.test.ts`, `__tests__/domain/gameSheet.test.ts`

**Interfaces:**
- Produces (in `substitution.ts`):
  - `interface Substitution { readonly substituteId: string; readonly mainPlayerId: string }`
  - `isValidSubstitutionList(playerIds: readonly string[], subs: readonly Substitution[]): boolean` — prueft die vier Regeln aus Global Constraints.
  - `effectiveSubstitutions(playerIds: readonly string[], subs: readonly Substitution[]): readonly Substitution[]` — filtert defensiv: behaelt in Reihenfolge nur Paare, die einzeln gueltig sind und deren Gast/Stammspieler nicht schon in einem frueheren behaltenen Paar vorkommt. Wird vom Calculator genutzt.
- Produces (in `gameSheet.ts`):
  - `GameSheet.substitutions: readonly Substitution[]`, `GameSheetPatch.substitutions?: readonly Substitution[]`
  - `referencedPlayerIds(sheet: GameSheet): readonly string[]` — `playerIds` plus alle `mainPlayerId`s, ohne Duplikate.
  - JSON-Key: `substitutions: [{ substituteId, mainPlayerId }]`.

- [ ] **Step 1: Failing tests schreiben**

`__tests__/domain/substitution.test.ts`:
- `isValidSubstitutionList(['a','b','c','d'], [{substituteId:'a', mainPlayerId:'x'}])` → `true`
- leere Liste → `true`
- Stammspieler im Bogen `[{substituteId:'a', mainPlayerId:'b'}]` → `false`
- Gast nicht im Bogen `[{substituteId:'z', mainPlayerId:'x'}]` → `false`
- Gast doppelt `[{a→x},{a→y}]` → `false`; Stammspieler doppelt `[{a→x},{b→x}]` → `false`
- `effectiveSubstitutions(['a','b','c','d'], [{a→x},{a→y},{b→c},{c→x},{d→w}])` → `[{a→x},{d→w}]`

`__tests__/domain/gameSheet.test.ts` (ergaenzen):
- `createGameSheet(...)` hat `substitutions` `[]`.
- Roundtrip `gameSheetFromJson(gameSheetToJson(s))` mit `substitutions: [{a→x}]` erhaelt das Paar.
- JSON ohne `substitutions`-Key → `[]`; JSON mit kaputten Eintraegen (`[null, {substituteId: 1}, {substituteId:'a', mainPlayerId:'x'}]`) → nur `[{a→x}]`, kein Throw.
- `copyGameSheet(s, { substitutions: [{a→x}] }).substitutions` → `[{a→x}]`; ohne Patch-Feld bleibt der alte Wert.
- `referencedPlayerIds` eines Bogens `['a','b','c','d']` mit `[{a→x}]` → enthaelt genau `a,b,c,d,x`.

- [ ] **Step 2: Tests laufen lassen** — `npx jest __tests__/domain/substitution.test.ts __tests__/domain/gameSheet.test.ts` → FAIL (Modul/Feld fehlt).

- [ ] **Step 3: Implementieren** — `substitution.ts` und die Aenderungen in `gameSheet.ts` gemaess Interfaces. `gameSheetFromJson` filtert Eintraege auf Objekte mit zwei String-Feldern (Gueltigkeit gegenueber `playerIds` wird **nicht** beim Laden erzwungen, nur beim Speichern ueber die UI und defensiv im Calculator).

- [ ] **Step 4: Alle GameSheet-Literale nachziehen** — `npm run typecheck` bis gruen; in jedem Test-Helfer `substitutions: []` ergaenzen.

- [ ] **Step 5: Verifizieren** — `npm run typecheck && npm run lint && npm test` → alles gruen.

- [ ] **Step 6: Commit** — `feat(sheet): Vertretungen (substitutions) im Spielbogen-Modell`

---

### Task 2: Rangliste mit Vertretungen

**Files:**
- Modify: `src/domain/scoring/groupRankingCalculator.ts`
- Test: `__tests__/scoring/groupRankingCalculator.test.ts`

**Interfaces:**
- Consumes: `effectiveSubstitutions` (Task 1), `GameSheet.substitutions`.
- Produces: `CalculateGroupRankingsInput.applySubstitutions?: boolean` (fehlend = `false`, damit bestehende Aufrufe unveraendert bleiben).

- [ ] **Step 1: Failing tests schreiben** — Helfer `sheetWith` um optionales `substitutions` erweitern; Pool-Lookup um `erik: { id: 'e', playerName: 'Erik' }` (Stammspieler, spielt nie selbst).
  - `Vertretung aus: Ergebnis identisch zu ohne substitutions` — Bogen a,b,c,d mit `[{substituteId:'d', mainPlayerId:'e'}]`, Re-Sieg a,b: `byPlayer(placementPoints)` = `{a:4,b:4,c:2,d:2}`, kein `e`.
  - `Vertretung an: Stammspieler bekommt Punkte des Gastes zusaetzlich` — gleicher Bogen, `applySubstitutions: true`: `{a:4,b:4,c:2,d:2,e:2}`; Eintrag `e` hat `displayName` `'Erik'`.
  - `Vertretung an: Spielpunkte und Soli unveraendert` — `totalPoints` und `wonSoli` mit `true` und `false` per `toEqual` gleich.
  - `Vertretung an: Stammspieler sammelt ueber Boegen` — zwei Boegen, auf beiden vertritt `d` den `e` → `e` = Summe der beiden `d`-Werte.
  - `Ungueltige Vertretung (Stammspieler spielt selbst) wird ignoriert` — Bogen a,b,c,d mit `[{substituteId:'d', mainPlayerId:'a'}]`, `true` → `a` hat dieselben Punkte wie bei `false`.
  - `Gast ohne Spiel auf dem Bogen bekommt nichts weiterzugeben` — 5er-Bogen mit Spielern a,b,c,d,x (`x` im Lookup ergaenzen), ein Spiel ohne x (x sitzt aus), Vertretung `x→e`, `true` → kein Eintrag `e`.

- [ ] **Step 2: Tests laufen lassen** — `npx jest __tests__/scoring/groupRankingCalculator.test.ts` → die neuen "an"-Tests FAIL.

- [ ] **Step 3: Implementieren** — nach der Platzierungsvergabe eines Bogens, wenn `applySubstitutions`: fuer jedes Paar aus `effectiveSubstitutions(sheet.playerIds, sheet.substitutions)`, dessen Gast in diesem Bogen Platzierungspunkte bekommen hat, dieselben Punkte auf `mainPlayerId` addieren und dessen Namen ueber `lookup` in `names` eintragen. `points`/`wonSoli` nicht anfassen. Den per-Bogen-Platzierungswert dafuer in einer lokalen Map halten.

- [ ] **Step 4: Tests laufen lassen** — gleicher Befehl → PASS; danach `npm test`.

- [ ] **Step 5: Commit** — `feat(rankings): Platzierungspunkte des Ersatzspielers dem Stammspieler gutschreiben`

---

### Task 3: Player-Usage, Export und Import

**Files:**
- Modify: `src/application/playerUsage.ts` (`isPlayerReferenced`, `referencedIdsFromSheets`)
- Modify: `src/application/export/exportService.ts` (`exportSheet`, `exportGroup`)
- Modify: `src/application/import/importApply.ts` (Sheets-Schleife)
- Test: `__tests__/application/playerUsage.test.ts`, `__tests__/application/exportService.test.ts`, `__tests__/application/importApply.test.ts`

**Interfaces:**
- Consumes: `referencedPlayerIds(sheet)` (Task 1).

- [ ] **Step 1: Failing tests schreiben**
  - playerUsage: `referencedIdsFromSheets([bogen a,b,c,d mit {d→x}])` enthaelt `x`; `isPlayerReferenced('x')` → `true` (Repository-Variante analog zu bestehenden Tests).
  - exportService: `exportSheet` und `exportGroup` eines Bogens mit `{d→x}` → `payload.players` enthaelt Spieler `x`.
  - importApply:
    - `addAsNew` mit Spieler-Remap `x→x2` → gespeicherter Bogen hat `substitutions` `[{substituteId:<remap d>, mainPlayerId:'x2'}]`; dasselbe fuer `addCopy`.
    - Stammspieler `x` als Spieler-Entscheidung `skip` → Bogen wird trotzdem importiert, `substitutions` `[]`.

- [ ] **Step 2: Tests laufen lassen** — `npx jest __tests__/application` → neue Tests FAIL.

- [ ] **Step 3: Implementieren**
  - playerUsage: statt `s.playerIds` → `referencedPlayerIds(s)`.
  - exportService: `referencedIds` aus `referencedPlayerIds(sheet)` bilden.
  - importApply: `substitutions` mit `playerRemap` remappen (wie `playerIds`) und Paare entfernen, deren `mainPlayerId` in der Menge der als `skip` entschiedenen Spieler liegt; das Ergebnis bei `copyGameSheet` bzw. im `addCopy`-Literal setzen. `importDiff.ts` bleibt unveraendert (ein uebersprungener Stammspieler blockiert den Bogen **nicht** — eigene Entscheidung, siehe Review Focus 4).

- [ ] **Step 4: Verifizieren** — `npm test` → PASS (inkl. `exportImportRoundtrip`).

- [ ] **Step 5: Commit** — `feat(export): Stammspieler von Vertretungen in Usage, Export und Import beruecksichtigen`

---

### Task 4: Vertretungen im Spielbogen erfassen (UI)

**Files:**
- Modify: `src/application/stores/sheetStore.ts`
- Create: `src/presentation/screens/sheet/SubstitutionsDialog.tsx` (falls es fuer Sheet-Dialoge noch keinen Unterordner gibt, neben `SheetScreen.tsx` als `SubstitutionsDialog.tsx`)
- Modify: `src/presentation/screens/SheetScreen.tsx` (Menue-Eintrag, Dialog einbinden, Hinweis)
- Modify: `src/presentation/i18n/locales/de.ts`, `en.ts`

**Interfaces:**
- Consumes: `Substitution`, `isValidSubstitutionList` (Task 1).
- Produces: `sheetStore.setSubstitutions(subs: readonly Substitution[]): Promise<void>` — wirft, wenn `isValidSubstitutionList` `false` liefert; sonst `copyGameSheet` + persist wie `setGroup`.

- [ ] **Step 1: Store-Methode** — `setSubstitutions` analog zu `setGroup` implementieren.

- [ ] **Step 2: Dialog bauen** — `SubstitutionsDialog({ visible, sheet, pool, onDismiss, onSave })`: Pro Bogen-Spieler eine Zeile "‹Name› vertritt: ‹— / Pool-Spieler›". Auswahlliste = Pool **ohne** Bogen-Spieler und ohne bereits in anderer Zeile gewaehlte Stammspieler. Speichern ruft `onSave(subs)`.

- [ ] **Step 3: Einbinden** — Menue-Eintrag `t('sheet.menuSubstitutions')` direkt nach `sheet.menuGroup`, **nur wenn `sheet.groupId !== null`**. Im Bogen dezenter Hinweis pro vertretenem Gast, z. B. unter dem Namen im Tabellenkopf oder als Zeile ueber der Tabelle: `t('sheet.substitutesFor', { name })`.

- [ ] **Step 4: i18n** — Keys (de / en):
  - `sheet.menuSubstitutions`: `Vertretungen` / `Substitutes`
  - `sheet.substitutionsTitle`: `Vertretungen` / `Substitutes`
  - `sheet.substitutionsHint`: `Wer spielt heute im Namen eines Stammspielers? Dessen Platzierungspunkte zählen in der Saison auch für den Stammspieler.` / `Who is playing on behalf of a regular player today? Their placement points also count for that player in the season.`
  - `sheet.substitutesForLabel`: `vertritt` / `substitutes for`
  - `sheet.substitutesNone`: `—` / `—`
  - `sheet.substitutesFor`: `{{substitute}} vertritt {{name}}` / `{{substitute}} substitutes for {{name}}`

- [ ] **Step 5: Verifizieren** — `npm run typecheck && npm run lint && npm test` gruen; App starten (`npm run android`), Bogen einer Saison oeffnen, Vertretung setzen, Bogen schliessen und wieder oeffnen → Vertretung bleibt; bei Bogen ohne Saison ist der Menue-Eintrag nicht sichtbar.

- [ ] **Step 6: Commit** — `feat(sheet): Vertretungen im Spielbogen erfassen`

---

### Task 5: Schalter in der Saison-Rangliste

**Files:**
- Modify: `src/presentation/screens/GroupRankingsScreen.tsx`
- Modify: `src/presentation/i18n/locales/de.ts`, `en.ts`

**Interfaces:**
- Consumes: `applySubstitutions` (Task 2).

- [ ] **Step 1: Implementieren** — `const [applySubstitutions, setApplySubstitutions] = useState(true);` an `calculateGroupRankings` durchreichen (auch in die `useMemo`-Deps). Schalter (`Switch` aus react-native-paper mit Label-Zeile) direkt ueber der Sektion "Platzierungspunkte"; nur anzeigen, wenn mindestens ein Bogen der Gruppe `substitutions.length > 0` hat.

- [ ] **Step 2: i18n** — `groups.rankings.applySubstitutions`: `Vertretungen einrechnen` / `Include substitutes`.

- [ ] **Step 3: Verifizieren** — `npm run typecheck && npm run lint && npm test` gruen; in der App: Saison mit Vertretung oeffnen → Schalter steht auf **an**, Stammspieler erscheint mit den Punkten des Gastes; Schalter aus → Stammspieler-Zeile faellt auf eigenen Wert zurueck bzw. verschwindet; Spielpunkte- und Soli-Liste aendern sich nicht.

- [ ] **Step 4: Commit** — `feat(rankings): Schalter "Vertretungen einrechnen" (Default an)`
