# Papier-Import (Punkte-Raster + optionale KI-Abschrift) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Papier-Spielbögen als Spielbogen mit reinen Punkte-Spielen erfassen: Raster zum Abtippen/Korrigieren, optional vorbelegt aus einer KI-Abschrift (Scan-JSON), mit Zuordnung der Spaltennamen zu Pool-Spielern.

**Architecture:** `Game` bekommt ein optionales Feld `pointsByPlayerId`. Eine gemeinsame Sicht `gamePointsByPlayer` liefert Punkte pro Spieler für beide Spielformen; `totalsFor`, Scoreboard, PDF und Gruppen-Rangliste laufen darüber. Ein reiner Raster-Zustand (`paperGrid`) validiert und baut den Bogen; neue Screens (Start, Raster) nutzen ihn über einen kleinen Draft-Store. Datenmodell-Änderung ist rückwärtskompatibel; Dateien mit Punkte-Spielen bekommen `formatVersion = 2`.

**Tech Stack:** TypeScript (strict), React Native 0.83 / Expo SDK 55, React Native Paper, Zustand, i18next, Jest. Keine neue Dependency.

**Spec:** `docs/superpowers/specs/2026-11-18-scan-import-design.md`

## Global Constraints

- Package-Manager npm; keine neuen Dependencies (insbesondere kein `expo-clipboard`). Reine TypeScript-Änderung, daher kein `npm ci` auf der anderen Umgebung nötig — im PR-Text trotzdem erwähnen, dass das Datenformat um `formatVersion = 2` erweitert wurde.
- Vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test` müssen grün sein (CLAUDE.md).
- Alte Daten, Backups und Exporte ohne `pointsByPlayerId` müssen unverändert funktionieren; Exporte ohne Punkte-Spiele bleiben `formatVersion = 1`.
- Ein Punkte-Spiel löst keine Bockrunde aus und trägt keinen Bock-Bonus.
- Zeilen mit Summe ≠ 0 blockieren das Speichern immer; die Papier-Summenzeile (`totals`) wird nie importiert, sie erzeugt nur einen nicht blockierenden Hinweis.
- 4 Spieler: kein leeres Feld (`null`); 5 Spieler: genau ein leeres Feld (`null`, Aussetzer) pro Zeile.
- Spiele-`playedAt` = Spieldatum des Bogens + Spielindex in Sekunden (aufsteigend); Reihenfolge in `rounds[].games` ist maßgeblich.
- Runden: Spiele der Reihe nach in Runden zu `gamesPerRound(sheet)` (4 bzw. 5) aufteilen; letzte Runde darf unvollständig sein.
- Neue Spieler werden erst beim Bestätigen angelegt, über `useSheetListStore.createSheet(sheet, players)` (legt fehlende Pool-Spieler an, speichert dann den Bogen).
- Sprachen: alle UI-Texte in `de.ts` und `en.ts` mit identischen Keys (`__tests__/presentation/i18n/localesShape.test.ts` prüft das). Prompt-JSON-Schlüssel bleiben immer englisch.
- Code- und Commit-Stil des Repos: deutsche Kommentare, Commit-Subjects `feat(bereich): text` ohne Umlaute; Commits enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Arbeitsbranch `feat/papier-import` (nicht auf `main` committen).

## Review Focus

- Nur eine Zeile (n = 1) bzw. ein leerer Bogen (0 Zeilen): Bestätigen muss bei 0 Zeilen blockiert sein. → Task 6.
- Zahl `0` in einer Zelle ist ein gültiger Wert und nicht "leer"; `-0` und Eingaben wie `+3`, `−3` (Unicode-Minus), `3,0` sollen sauber normalisiert bzw. abgelehnt werden. → Task 6.
- KI-Antwort mit Fließtext/Codeblock drumherum, mit mehreren JSON-Objekten oder mit Kommentar nach dem JSON. → Task 5.
- Pool-Spieler mit gleichem Namen in anderer Schreibweise, zwei Spalten mit demselben Namen, Namen mit Leerzeichen am Rand. → Task 6.
- Bogen mit Punkte-Spielen und später normal ergänzten Spielen: Summen, Bock-Banner und Rangliste müssen stimmen. → Tasks 2, 3.

---

### Task 0: Branch

- [ ] **Step 1:** `git switch -c feat/papier-import` (von `main`); `git status` muss sauber sein.

---

### Task 1: `Game` mit optionalem Punkte-Feld

**Files:**
- Modify: `src/domain/models/game.ts`
- Test: `__tests__/domain/game.test.ts` (neu)

**Interfaces:**
- Produces:
  - `Game.pointsByPlayerId?: Readonly<Record<string, number>>` (fehlt bei normalen Spielen; enthält nur aktive Spieler, Aussetzer stehen nur in `sittingOutPlayerId`)
  - `isPointsGame(game: Game): boolean`
  - `createPointsGame(input: { pointsByPlayerId: Readonly<Record<string, number>>; sittingOutPlayerId?: string | null; playedAt?: Date }): Game` — setzt `rePlayerIds: []`, `contraPlayerIds: []`, `winner: 're'`, `flagCodes: []`, `note: null`, `isSolo: false`, `triggersManualBock: false`; wirft `Error` bei nicht ganzzahligen Werten, Summe ≠ 0 oder leerer Map.
  - `GamePatch.pointsByPlayerId?: Readonly<Record<string, number>>`; `copyGame` muss das Feld erhalten (auch wenn nicht im Patch) und ändern können.
  - `gameToJson` schreibt `pointsByPlayerId` nur, wenn gesetzt; `gameFromJson` liest es nur, wenn es ein Objekt mit ausschließlich ganzzahligen Werten ist, sonst Feld weglassen.

- [ ] **Step 1: Failing tests** in `__tests__/domain/game.test.ts`:
  - `createPointsGame({pointsByPlayerId:{a:3,b:3,c:-3,d:-3}})` → `isPointsGame` true, `rePlayerIds` `[]`, `flagCodes` `[]`.
  - wirft bei `{a:3,b:-2}` (Summe ≠ 0), bei `{a:1.5,b:-1.5}` und bei `{}`.
  - Round-trip: `gameFromJson(gameToJson(g))` ergibt gleiches `pointsByPlayerId`; `sittingOutPlayerId` bleibt erhalten.
  - Normales Spiel (`createGame`): `gameToJson(g)` hat keinen Key `pointsByPlayerId`; `isPointsGame` false.
  - Altes JSON ohne das Feld → `isPointsGame` false.
  - `copyGame(pointsGame, {})` behält das Feld; `copyGame(pointsGame, {pointsByPlayerId:{...}})` ersetzt es.
- [ ] **Step 2:** `npx jest __tests__/domain/game.test.ts` → FAIL (Funktionen fehlen).
- [ ] **Step 3:** Implementieren in `game.ts` (Signaturen oben).
- [ ] **Step 4:** `npx jest __tests__/domain/game.test.ts` → PASS; `npm run typecheck` grün.
- [ ] **Step 5:** Commit `feat(game): Punkte-Spiel mit optionalem pointsByPlayerId`.

---

### Task 2: Gemeinsame Punktesicht und `totalsFor`

**Files:**
- Create: `src/domain/scoring/gamePoints.ts`
- Modify: `src/domain/scoring/scoreCalculator.ts` (`totalsFor`)
- Test: `__tests__/domain/gamePoints.test.ts` (neu)

**Interfaces:**
- Consumes: `Game`, `isPointsGame` (Task 1); `scoreFor`, `resolveBock`, `BockLevel`, `BockStackingMode`.
- Produces:
  - `gamePointsByPlayer(game: Game, level: BockLevel): ReadonlyMap<string, number>` — Punkte-Spiel: Einträge aus `pointsByPlayerId`; normales Spiel: Re-IDs → `rePerPlayer`, Kontra-IDs → `contraPerPlayer` (aus `scoreFor(game, level)`); Aussetzer fehlen.
  - `export interface GameRow { gameId: string; pointsByPlayerId: ReadonlyMap<string, number>; sittingOutPlayerId: string | null; bockLevel: BockLevel; soloPlayerId: string | null }`
  - `gameRowsFor(sheet: GameSheet, mode: BockStackingMode): readonly GameRow[]` — pro Spiel in Reihenfolge von `allGames(sheet)`; `bockLevel` aus `resolveBock`; `soloPlayerId` = `rePlayerIds[0]` bei `isSolo`, sonst `null`.
  - `totalsFor` liefert für alle `sheet.playerIds` Totals (0-initialisiert), addiert via `gamePointsByPlayer`; Verhalten für normale Spiele unverändert.

- [ ] **Step 1: Failing tests:**
  - Punkte-Spiele `{a:3,b:3,c:-3,d:-3}` und `{a:-9,b:3,c:3,d:3}` in einem 4er-Bogen: `totalsFor(sheet, sequential).totalsByPlayerId` = a −6, b 6, c 0, d 0.
  - Bogen mit normalem Solo-Spiel (Re `a`, Kontra `b,c,d`, Winner `re`, keine Flags → Netto 1: a +3, b/c/d −1) **plus** Punkte-Spiel: Totals sind die Summe beider.
  - Punkte-Spiel löst keinen Bock aus: normales Spiel nach einem Punkte-Spiel hat `BockLevel.none` (via `gameRowsFor(...)[1].bockLevel`).
  - 5er-Bogen: Punkte-Spiel mit `sittingOutPlayerId:'e'` → `gameRowsFor` liefert `sittingOutPlayerId:'e'`, Map ohne `e`.
  - Normale Spiele: `gamePointsByPlayer` stimmt mit `scoreFor` überein (Re/Kontra).
- [ ] **Step 2:** `npx jest __tests__/domain/gamePoints.test.ts` → FAIL.
- [ ] **Step 3:** `gamePoints.ts` anlegen; `totalsFor` auf `gamePointsByPlayer` umstellen.
- [ ] **Step 4:** Test PASS; `npm run typecheck` grün; `npm test` (nichts Bestehendes bricht).
- [ ] **Step 5:** Commit `feat(scoring): gemeinsame Punktesicht pro Spieler fuer normale und Punkte-Spiele`.

---

### Task 3: Gruppen-Rangliste

**Files:**
- Modify: `src/domain/scoring/groupRankingCalculator.ts` (Ermittlung `activeIds`, ca. Zeile 60-66)
- Test: `__tests__/domain/groupRankingPointsGames.test.ts` (neu)

**Interfaces:** Consumes `Game.pointsByPlayerId` (Task 1), `totalsFor` (Task 2). Produces: unverändert `calculateGroupRankings`.

- [ ] **Step 1: Failing test:** Gruppe mit einem 4er-Bogen aus nur Punkte-Spielen (a +6, b +3, c −3, d −6): `totalPoints` enthält alle vier Spieler mit diesen Werten, Platzierungspunkte 4/3/2/1 für a/b/c/d, `wonSoli` ist für alle 0. Zweiter Fall: Punkte-Spiele in einem Bogen werden nicht als "inaktiv" übersprungen (Spieler erscheinen).
- [ ] **Step 2:** Test FAIL (Spieler fehlen, `activeIds.size === 0`).
- [ ] **Step 3:** In der `activeIds`-Schleife zusätzlich `Object.keys(game.pointsByPlayerId ?? {})` aufnehmen. `wonSoli` bleibt unverändert (Punkte-Spiele haben `isSolo: false`).
- [ ] **Step 4:** Test PASS; `npm test` grün.
- [ ] **Step 5:** Commit `feat(ranking): Punkte-Spiele zaehlen in der Gruppen-Rangliste`.

---

### Task 4: Dateiformat (`formatVersion` 1/2)

**Files:**
- Modify: `src/application/export/exportTypes.ts`, `src/application/export/exportService.ts` (`envelope`), `src/application/import/importParser.ts`
- Test: `__tests__/application/importParser.test.ts`, `__tests__/application/exportService.test.ts` (erweitern)

**Interfaces:**
- Produces in `exportTypes.ts`:
  - `FORMAT_VERSION = 1` (bleibt), `FORMAT_VERSION_POINTS_GAMES = 2`, `SUPPORTED_FORMAT_VERSIONS: readonly number[]` = `[1, 2]`
  - `ExportEnvelope.formatVersion: number` (statt `typeof FORMAT_VERSION`)
  - `formatVersionFor(sheets: readonly GameSheet[]): number` → 2, wenn irgendein Spiel `isPointsGame`, sonst 1.
- `exportService.envelope(kind, payload, exportedAt)` setzt `formatVersion: formatVersionFor(payload.sheets)`.
- `parseExportFile` akzeptiert 1 und 2, setzt `envelope.formatVersion` auf den gelesenen Wert; Fehlermeldung nennt die unterstützten Versionen.

- [ ] **Step 1: Failing tests:** Parser akzeptiert `formatVersion: 2` mit Sheet, das ein Punkte-Spiel enthält, und liefert `pointsByPlayerId` zurück; `formatVersion: 99` wirft weiterhin `/formatVersion/`; Export eines Bogens mit Punkte-Spiel hat `formatVersion` 2, ohne Punkte-Spiele 1 (bestehender Test `toBe(FORMAT_VERSION)` bleibt grün).
- [ ] **Step 2:** Tests FAIL.
- [ ] **Step 3:** Implementieren; Aufrufer von `envelope.formatVersion`-Typ anpassen (`importDiff.test.ts` verwendet `FORMAT_VERSION` — bleibt gültig).
- [ ] **Step 4:** `npx jest __tests__/application` PASS, `npm run typecheck` grün.
- [ ] **Step 5:** Commit `feat(export): formatVersion 2 fuer Boegen mit Punkte-Spielen`.

---

### Task 5: Scan-Parser und Prompt

**Files:**
- Create: `src/application/import/scanParser.ts`, `src/application/import/scanPrompt.ts`
- Test: `__tests__/application/scanParser.test.ts`, `__tests__/application/scanPrompt.test.ts`

**Interfaces:**
- Produces in `scanParser.ts`:
  - `class ScanParseError extends Error`
  - `export interface ScanSheet { title: string | null; playedAt: Date | null; players: readonly string[]; games: readonly (readonly (number | null)[])[]; totals: readonly (number | null)[] | null; uncertain: readonly { game: number; player: number }[] }` (`uncertain`-Indizes 0-basiert wie im Spec)
  - `parseScanText(raw: string): ScanSheet`
  - Verhalten: erstes ausgewogenes `{…}`-Objekt im Text lesen (Markdown-Codeblöcke und Fließtext davor/danach ignorieren; Klammern in Strings beachten); `kind` muss `'scan'` sein; `app`/`formatVersion` optional, wenn `formatVersion` vorhanden dann `1`; `players`: 4 oder 5 nichtleere Strings (getrimmt); jede `games[i].points` hat Länge `players.length`, Werte ganzzahlig oder `null`; `totals` (falls vorhanden) gleiche Länge, Werte ganzzahlig oder `null`; `playedAt` als `YYYY-MM-DD` oder ISO-String, sonst `null`; Fehlermeldungen auf Deutsch mit 1-basierter Zeilennummer bei Zeilenfehlern (z. B. `Spiel 3: erwartet 4 Werte, gefunden 3.`).
- Produces in `scanPrompt.ts`: `buildScanPrompt(language: 'de' | 'en'): string` — enthält den Auftrag (abschreiben, nicht rechnen/korrigieren/erfinden, `null` für leere Felder/Striche, unsichere Zellen in `uncertain`, nur ein JSON-Objekt zurückgeben), das Schema aus dem Spec mit den englischen Schlüsseln `app`, `kind: "scan"`, `formatVersion`, `title`, `playedAt`, `players`, `games`, `points`, `totals`, `uncertain` und erwähnt ausdrücklich, dass eine Bock-Markierung des Papiers ignoriert wird.

- [ ] **Step 1: Failing tests (`scanParser`):** gültiges Beispiel aus dem Spec (3 Spiele, `null` in Zeile 3, `totals`, `uncertain`); JSON in ```` ```json ```` -Block mit Fließtext davor und danach; Text mit `{`/`}` in einem String-Wert; `kind: 'other'` wirft; 3 Spieler wirft; Zeile mit falscher Länge wirft mit `/Spiel 2/`; Wert `1.5` und `"3"` werfen; nur `players` und leeres `games: []` ist gültig (0 Zeilen); fehlendes JSON wirft verständliche Meldung; zweites JSON-Objekt im Text wird ignoriert.
- [ ] **Step 2:** Tests FAIL.
- [ ] **Step 3:** `scanParser.ts` implementieren (kein Regex-JSON-Hack; Klammer-Scanner mit String-/Escape-Behandlung, dann `JSON.parse`).
- [ ] **Step 4: Failing tests (`scanPrompt`):** für `de` und `en` enthält der Text `"kind": "scan"`, `"points"`, `"uncertain"` und `null`; beide Sprachen enthalten dieselben Schlüsselnamen; das Beispiel-JSON im Prompt wird von `parseScanText` fehlerfrei gelesen (aus dem Prompt extrahieren).
- [ ] **Step 5:** `scanPrompt.ts` implementieren; beide Testdateien PASS; `npm run typecheck`.
- [ ] **Step 6:** Commit `feat(import): Scan-Parser und KI-Prompt fuer Papier-Abschrift`.

---

### Task 6: Raster-Zustand, Validierung, Bogenbau

**Files:**
- Create: `src/application/paper/paperGrid.ts`
- Test: `__tests__/application/paperGrid.test.ts`

**Interfaces:**
- Consumes: `ScanSheet` (Task 5), `Player`/`createPlayer`, `createGameSheet`/`gamesPerRound` (`gameSheet.ts`), `createPointsGame` (Task 1).
- Produces:
  - `type PaperCell = number | null`
  - `type PlayerAssignment = { kind: 'unassigned' } | { kind: 'pool'; playerId: string } | { kind: 'new'; name: string }`
  - `interface PaperGrid { title: string; playedAt: Date; columnNames: string[]; assignments: PlayerAssignment[]; rows: PaperCell[][]; paperTotals: (number | null)[] | null; uncertain: { game: number; player: number }[]; }`
  - `emptyGrid(playerCount: 4 | 5, playedAt: Date): PaperGrid` — Spaltennamen `''`, 0 Zeilen, alle `unassigned`.
  - `gridFromScan(scan: ScanSheet, pool: readonly Player[]): PaperGrid` — `columnNames` = `scan.players`; Zuordnung per `matchPlayer`; `playedAt` = `scan.playedAt ?? new Date()`; leere Aussetzer-Zeilen bleiben `null`.
  - `matchPlayer(name: string, pool: readonly Player[]): string | null` — exakter Treffer ohne Groß-/Kleinschreibung und Rand-Leerzeichen, sonst eindeutiger Präfix-Treffer, sonst `null`; bei mehreren Treffern `null`.
  - `setCell(grid, row: number, col: number, value: PaperCell): PaperGrid`; `addRow(grid): PaperGrid` (neue Zeile: 4er → `[0,0,0,0]`; 5er → `null` in Spalte `rows.length % 5`, sonst `0`, also die App-Rotation als Vorschlag, den Thomas per `setRowSitter` ändern kann); `removeRow(grid, row): PaperGrid`; `setRowSitter(grid, row: number, col: number): PaperGrid` (setzt `col` auf `null`, der bisherige `null`-Eintrag der Zeile wird `0`).
  - `parseCellInput(text: string): number | null | 'invalid'` — akzeptiert `-3`, `+3`, `−3` (Unicode-Minus), `0`, `-0` → `0`; `''` und `—`/`-` allein → `null`; `3,0`, `1.5`, `abc` → `'invalid'`.
  - `computedColumnTotals(grid): number[]` — Summe je Spalte, `null` zählt 0.
  - `interface GridValidation { rowIssues: { row: number; kind: 'sum' | 'empty' | 'sitter' }[]; assignmentIssues: { col: number; kind: 'unassigned' | 'duplicate' }[]; similarNameWarnings: { col: number; poolPlayerId: string }[]; paperTotalsMismatch: boolean; canConfirm: boolean }`
  - `validateGrid(grid: PaperGrid, pool: readonly Player[]): GridValidation` — `sum`: Summe der Nicht-`null`-Zellen ≠ 0; `empty`: 4er-Zeile mit `null`; `sitter`: 5er-Zeile mit ≠ 1 `null`; `duplicate`: gleicher Pool-Spieler oder gleicher neuer Name (case-/whitespace-insensitiv) in zwei Spalten, oder neuer Name gleich Pool-Name → als `similarNameWarnings` (nicht blockierend); `paperTotalsMismatch`: `paperTotals` vorhanden und ≠ `computedColumnTotals`; `canConfirm`: ≥ 1 Zeile, keine `rowIssues`, keine `assignmentIssues`.
  - `buildSheetFromGrid(grid: PaperGrid, players: readonly Player[]): GameSheet` — `players` in Spaltenreihenfolge; `createGameSheet({ players, title: grid.title, at: grid.playedAt })`; Spiel i: `createPointsGame({ pointsByPlayerId, sittingOutPlayerId, playedAt: new Date(grid.playedAt.getTime() + i * 1000) })` (Aussetzer-Spalte fehlt in der Map); Runden zu `gamesPerRound`; `stackingModeOverride` bleibt `null`.

- [ ] **Step 1: Failing tests** (Auswahl, alle Assertions mit konkreten Werten):
  - `matchPlayer('anna ', pool)` findet `Anna`; `'An'` mit `Anna` und `Anton` im Pool → `null`; `'Ant'` → Anton.
  - `parseCellInput`: `'+3'`→3, `'−3'`→-3, `'-0'`→0, `'0'`→0, `''`→null, `'3,0'`→'invalid', `'1.5'`→'invalid'.
  - Leeres Raster mit 0 Zeilen: `canConfirm` false. Eine gültige Zeile `[3,3,-3,-3]` + vollständige Zuordnung: `canConfirm` true.
  - Zeile `[3,3,-3,-2]` → `rowIssues` enthält `{row:0,kind:'sum'}`; 4er-Zeile `[3,3,-6,null]` → `kind:'empty'`; 5er-Zeile ohne `null` oder mit zwei `null` → `kind:'sitter'`.
  - Zwei Spalten mit Pool-Spieler `p1` → `duplicate`; zwei neue Namen `'Ben'` und `' ben '` → `duplicate`; neuer Name `'anna'` bei Pool-Spieler `Anna` → `similarNameWarnings`, `canConfirm` bleibt true, wenn sonst gültig.
  - `paperTotals` abweichend → `paperTotalsMismatch` true und `canConfirm` unverändert true.
  - `buildSheetFromGrid`: 5 Spiele in einem 4er-Bogen → 2 Runden (4 + 1), `totalsFor` stimmt mit `computedColumnTotals`; `playedAt` der Spiele aufsteigend; 5er-Bogen: `sittingOutPlayerId` stammt aus dem `null`-Eintrag der Zeile.
  - `setRowSitter` verschiebt den Aussetzer und setzt die alte Stelle auf `0`.
- [ ] **Step 2:** `npx jest __tests__/application/paperGrid.test.ts` → FAIL.
- [ ] **Step 3:** `paperGrid.ts` implementieren (reine Funktionen, immutable Updates).
- [ ] **Step 4:** Tests PASS, `npm run typecheck`, `npm run lint`.
- [ ] **Step 5:** Commit `feat(paper): Raster-Zustand, Validierung und Bogenbau`.

---

### Task 7: Anzeige im Bogen (Scoreboard, Runden, PDF)

**Files:**
- Modify: `src/presentation/screens/SheetScreen.tsx` (Block `useMemo` ca. Zeile 118-149), `src/presentation/widgets/RoundSection.tsx`, `src/application/export/sheetHtml.ts` (`renderSheetHtml` ca. Zeile 266-290 und Runden-Rendering ca. Zeile 140-180), `src/presentation/i18n/locales/de.ts`, `en.ts`
- Test: `__tests__/application/sheetHtmlPointsGames.test.ts` (neu)

**Interfaces:**
- Consumes: `gameRowsFor`, `gamePointsByPlayer` (Task 2), `isPointsGame` (Task 1).
- Produces: `RoundSection` bekommt zusätzliches Prop `pointsByGame: ReadonlyMap<string, ReadonlyMap<string, number>>`; für Punkte-Spiele zeigt die Zeile statt Re/Kontra/Gewinner/Flags die Beschriftung `sheet.pointsGameLabel` und pro Spieler `Name +3`, getrennt mit ` · `; `onEditGame` bleibt wie bisher. i18n-Keys (de/en): `sheet.pointsGameLabel` ("Papier-Spiel" / "Paper game"), `sheet.pointsGameSittingOut` nicht nötig (vorhandenes `sheet.sittingOut` nutzen).
- `SheetScreen` und `renderSheetHtml` ersetzen die duplizierte Zeilenberechnung durch `gameRowsFor(sheet, mode)`; Scoreboard-Props bleiben kompatibel (`pointsByGame` aus `GameRow`).

- [ ] **Step 1: Failing test:** `buildSheetHtml` (bzw. `renderSheetHtml` mit gemocktem Repository, wie bestehende Tests es handhaben — andernfalls `buildSheetHtml` direkt mit einem Bogen aus Punkte-Spielen aufrufen): enthält die Punkte `+3`/`-3` je Spieler, die Σ-Zeile mit den korrekten Summen, nicht den Text `Re:`/`Kontra:` für diese Spiele und wirft nicht bei `flagCodes: []`.
- [ ] **Step 2:** Test FAIL (Rendering greift auf Re-/Kontra-IDs zu).
- [ ] **Step 3:** `gameRowsFor` in beiden Konsumenten einsetzen; Runden-Rendering in `sheetHtml.ts` und `RoundSection.tsx` für Punkte-Spiele verzweigen (Spielzeile ohne Teams/Flags).
- [ ] **Step 4:** Test PASS; `npm run typecheck`, `npm run lint`, `npm test`.
- [ ] **Step 5:** Commit `feat(sheet): Anzeige und PDF fuer Punkte-Spiele`.

---

### Task 8: Punkte-Spiel bearbeiten

**Files:**
- Create: `src/presentation/widgets/PointsGameDialog.tsx`
- Modify: `src/presentation/screens/SheetScreen.tsx` (`onEditGame`, ca. Zeile 256), `de.ts`, `en.ts`
- Test: `__tests__/application/paperGrid.test.ts` (kleine Ergänzung) — die Dialog-Logik wird über `parseCellInput` (Task 6) und die Summenprüfung getestet

**Interfaces:**
- Produces: `PointsGameDialog(props: { visible: boolean; game: Game | null; players: readonly Player[]; onDismiss: () => void; onSubmit: (pointsByPlayerId: Record<string, number>) => void })` — eine Zahleneingabe je aktivem Spieler (Aussetzer-Spieler ausgeblendet), Summe live, Speichern nur bei Summe 0 und gültigen Zahlen (`parseCellInput`); Fehlertext `pointsGame.sumError`.
- `SheetScreen.onEditGame(game)`: bei `isPointsGame(game)` Dialog öffnen, sonst `navigation.navigate('AddGame', …)` wie bisher. `onSubmit` ruft `useSheetStore.updateGame(copyGame(game, { pointsByPlayerId }))`. Löschen läuft unverändert über `onDeleteGame`.
- i18n-Keys: `pointsGame.editTitle`, `pointsGame.sumError`, `pointsGame.sumLabel`, `common.save` wiederverwenden (vorhanden prüfen, sonst `pointsGame.save`).

- [ ] **Step 1: Test:** `copyGame(pointsGame, {pointsByPlayerId})` ist bereits in Task 1 abgedeckt; hier in `paperGrid.test.ts` einen Test ergänzen, dass `parseCellInput` die Dialog-Werte `'5'`, `'-5'` akzeptiert und eine Gesamtsumme von `0` nur bei ausgeglichener Eingabe entsteht (Helferfunktion `sumOf(values: number[]): number` falls nötig).
- [ ] **Step 2:** Dialog und Verdrahtung implementieren; `npm run typecheck`, `npm run lint`, `npm test`.
- [ ] **Step 3:** Commit `feat(sheet): Punkte-Spiel ueber Dialog bearbeiten`.

---

### Task 9: Start-Screen, Draft-Store, Prompt weitergeben, Route

**Files:**
- Create: `src/application/stores/paperDraftStore.ts`, `src/data/share/sharePromptText.ts`, `src/data/share/sharePromptText.web.ts`, `src/presentation/screens/PaperSheetStartScreen.tsx`
- Modify: `src/navigation/types.ts` (`PaperSheetStart: undefined; PaperSheetGrid: undefined`), `App.tsx` (Screens registrieren; `HomeHeaderRight` um `IconButton` mit Icon `file-document-edit-outline` → `navigation.navigate('PaperSheetStart')` ergänzen), `de.ts`, `en.ts` (Namespace `paperImport`)
- Test: `__tests__/data/sharePromptTextWeb.test.ts`, `__tests__/application/paperDraftStore.test.ts`

**Interfaces:**
- Consumes: `buildScanPrompt`, `parseScanText`, `ScanParseError` (Task 5); `emptyGrid`, `gridFromScan` (Task 6); `pickImportFile`/`readTextFile(uri: string): Promise<string>`; `usePlayerListStore`.
- Produces:
  - `usePaperDraftStore`: Zustand-Store `{ grid: PaperGrid | null; setGrid(g: PaperGrid | null): void; reset(): void }`.
  - `sharePromptText(text: string): Promise<'shared' | 'copied' | 'cancelled'>` — native: `Share.share({ message: text })` aus `react-native` (`dismissedAction` → `'cancelled'`); `.web.ts`: `navigator.clipboard.writeText` (→ `'copied'`), Fallback bei fehlender API: wirft `Error`, damit die UI einen Fehlertext zeigt.
  - Start-Screen: drei Wege — "Leeres Raster (4 Spieler)", "Leeres Raster (5 Spieler)", "KI-Abschrift verwenden". Der KI-Weg zeigt den Prompt (nach App-Sprache aus `useTranslation().i18n.language`, Fallback `de`), Button "Prompt teilen/kopieren", ein mehrzeiliges Textfeld zum Einfügen der KI-Antwort, Button "Datei wählen" (`pickImportFile` → `readTextFile`), Button "Weiter" (parst; bei `ScanParseError` Fehlermeldung unter dem Feld; sonst `setGrid(gridFromScan(scan, pool))` und `navigation.navigate('PaperSheetGrid')`). Leere Raster: `setGrid(emptyGrid(n, new Date()))` und Navigation.
- i18n-Namespace `paperImport` mit allen Texten dieses und des nächsten Tasks (Titel, Buttons, Fehlertexte, Hinweis zur Summenzeile).

- [ ] **Step 1: Failing tests:** `paperDraftStore`: `setGrid` setzt, `reset` leert. `sharePromptTextWeb`: mit gemocktem `navigator.clipboard.writeText` → `'copied'` und Aufruf mit dem Text; ohne `navigator.clipboard` → wirft.
- [ ] **Step 2:** Tests FAIL → implementieren → PASS.
- [ ] **Step 3:** Screen und Route bauen; `npm run typecheck`, `npm run lint`, `npm test`.
- [ ] **Step 4:** Commit `feat(paper): Start-Screen mit leerem Raster und KI-Abschrift`.

---

### Task 10: Raster-Screen und Speichern

**Files:**
- Create: `src/presentation/screens/PaperSheetGridScreen.tsx`
- Modify: `de.ts`, `en.ts` (Namespace `paperImport`)
- Test: keine neuen Unit-Tests (Logik liegt in Task 6); Verifikation per Typecheck und manuell

**Interfaces:**
- Consumes: `usePaperDraftStore` (Task 9); `setCell`, `addRow`, `removeRow`, `setRowSitter`, `parseCellInput`, `validateGrid`, `computedColumnTotals`, `buildSheetFromGrid` (Task 6); `createPlayer`; `useSheetListStore.createSheet(sheet, players)`; `usePlayerListStore.refresh`; `parseDateTime`/`formatDate`/`formatTime`; Scoreboard-ähnliche Tabellenoptik.
- Verhalten:
  - Kopf: Titel-Textfeld, Datum/Uhrzeit (wie im Dialog in `SheetScreen`, gleiche Parser), je Spalte Name aus `columnNames` (editierbar) und Zuordnungs-Dropdown (Paper `Menu`): Pool-Spieler, "Neu anlegen (<Name>)", Vorbelegung aus `assignments`. Doppelte Zuordnung und Namenswarnungen aus `validateGrid` werden an der Spalte angezeigt.
  - Tabelle: Zahlenfeld pro Zelle (`parseCellInput`; ungültige Eingabe rot, Wert unverändert), Zeilensumme mit ✓/⚠ (Zeilenfehler aus `validateGrid`), bei 5 Spielern Schaltfläche je Zelle "Aussetzer" (`setRowSitter`), "Zeile hinzufügen", Zeile löschen. `uncertain`-Zellen farblich hervorgehoben.
  - Fuß: berechnete Spaltensummen (`computedColumnTotals`); bei `paperTotalsMismatch` nicht blockierender Hinweis `paperImport.paperTotalsHint`.
  - "Bogen anlegen" aktiv nur bei `canConfirm`. Aktion: Spieler je Spalte auflösen (`pool` → vorhandener `Player`, `new` → `createPlayer({ playerName: name.trim() })`), `buildSheetFromGrid`, `createSheet(sheet, players)`, `usePlayerListStore.getState().refresh()`, `usePaperDraftStore.getState().reset()`, dann `navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Sheet', params: { sheetId: sheet.id } }] })`. Fehler beim Speichern: Meldung anzeigen, Draft bleibt erhalten.
  - Ohne Draft (`grid === null`, z. B. nach App-Neustart): `navigation.replace('PaperSheetStart')`.

- [ ] **Step 1:** Screen implementieren (Zustand ausschließlich über `paperGrid`-Funktionen ändern).
- [ ] **Step 2:** `npm run typecheck`, `npm run lint`, `npm test`.
- [ ] **Step 3: Manuelle Prüfung** (`npm run web` oder Gerät): (a) leeres 4er-Raster, drei Zeilen eingeben, neuer Spieler + Pool-Spieler zuordnen, anlegen → Bogen erscheint mit richtigen Summen in Scoreboard und in der Gruppen-Rangliste (Bogen einer Gruppe zuordnen); (b) KI-JSON aus dem Prompt-Beispiel einfügen → Raster vorbelegt, `uncertain`-Zelle hervorgehoben, Papier-Summen-Hinweis erscheint bei absichtlich falschem `totals`; (c) eine Zeile mit Summe ≠ 0 blockiert den Button; (d) Punkte-Spiel antippen → Dialog, Wert ändern, Summe-≠-0-Fehler; (e) normales Spiel zum importierten Bogen hinzufügen → Summen stimmen; (f) Bogen exportieren und wieder importieren (Datei hat `formatVersion` 2); (g) PDF-Export zeigt die Punkte.
- [ ] **Step 4:** Commit `feat(paper): Raster-Screen zum Erfassen und Speichern`.

---

### Task 11: Abschluss und Plattform-Check

**Files:** `docs/superpowers/specs/2026-11-18-scan-import-design.md` (Status → "umgesetzt"), ggf. `CLAUDE.md` unverändert.

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm test` — alle grün.
- [ ] **Step 2:** `npm run android` (Windows-Umgebung): App startet, Papier-Import-Ablauf aus Task 10 (a) funktioniert, "Prompt teilen" öffnet das System-Share-Sheet.
- [ ] **Step 3:** Spec-Status auf "umgesetzt" setzen; Commit `docs(paper): Status Papier-Import umgesetzt`.
- [ ] **Step 4:** PR-Text (mit `🤖 Generated with [Claude Code](https://claude.com/claude-code)` am Ende) nennt: Datenformat `formatVersion 2` für Bögen mit Punkte-Spielen; keine neue Dependency; macOS/iOS-Build-Check (`npm run ios`) steht aus und wird in der anderen Umgebung gezielt nachgezogen.
