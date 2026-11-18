# Spielbogen aus Papier erfassen (Punkte-Raster + optionale KI-Abschrift) — Design

Stand: 2026-11-18. Status: Entwurf (überarbeitet nach Entscheidung "B + E"), Builder-Check erledigt, wartet auf Freigabe durch Thomas.

## Absicht und Warum

Thomas besitzt Papier-Spielbögen (Tabelle: eine Spalte für die Spielnummer, je eine Spalte pro Spieler, pro Zeile die Punkte dieses Spiels, optional eine Summenzeile). Es sind nicht viele; sie sollen in die App, damit Summen und Gruppen-Rangliste stimmen.

Zwei Wege führen zum selben Ergebnis:

- **Von Hand (E):** Thomas tippt die Zahlen vom Papier in ein Raster ab.
- **Mit KI-Vorbelegung (optional):** Die App liefert einen Prompt. Thomas gibt Prompt + Foto/Scan in einen externen KI-Chat (ChatGPT, Claude o. Ä.), die KI antwortet mit einer JSON-Datei, die das Raster vorbelegt. Die App enthält **keine KI, keinen API-Key, kein OCR**.

In beiden Fällen prüft und korrigiert Thomas im Raster, ordnet die Spielernamen bestehenden Spielern zu und speichert. Gespeichert werden **reine Punkte pro Spiel (B)**, keine Teams, Flags oder Bock.

## Ziele

- Ein Papierbogen wird als Spielbogen angelegt, dessen Gesamtpunkte pro Spieler mit dem Papier übereinstimmen.
- Der Bogen zählt in der Gruppen-Rangliste und im PDF-Export wie jeder andere.
- Fehler beim Abschreiben (von Hand oder durch die KI) werden vor dem Speichern gefunden und behoben.
- Spieler werden bestehenden Pool-Spielern zugeordnet; unbekannte Namen können neu angelegt werden.
- Die KI schreibt nur ab, sie rechnet und interpretiert nicht.

## Nicht-Ziele

- Keine KI/OCR in der App.
- **Keine Rekonstruktion** von Teams, Gewinnern, Flags oder Bockrunden aus den Punkten. Keine Bockrunden-Erkennung.
- Keine Gruppenzuordnung und keine Vertretungen beim Import (danach in der App setzbar).
- Kein "Anpassungs"-Notausgang: Zeilen mit falscher Summe blockieren das Speichern.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Ein Bogen wird gespeichert, dessen Summen nicht zum Papier passen, ohne dass Thomas es bemerkt.
- Die KI-Antwort wird ungeprüft übernommen.
- Bestehende Spieler werden stillschweigend dupliziert oder falsch zugeordnet.
- Bestehende Bögen, Backups oder Exporte gehen durch das neue Spielformat kaputt.

## Kontext im Code (Ist-Zustand)

- `Game` (`src/domain/models/game.ts`) speichert Rohdaten: Re-/Kontra-Spieler-IDs, `winner`, `flagCodes`, `isSolo`, `triggersManualBock`, `sittingOutPlayerId`. Punkte werden berechnet.
- `scoreFor(game, bockLevel)` (`scoreCalculator.ts`) liefert `{rePerPlayer, contraPerPlayer}`, also Punkte pro **Seite**. `totalsFor(sheet, mode)` summiert über den Bogen und nutzt `resolveBock`.
- Verbraucher der Punkteberechnung: `scoreCalculator.ts`, `SheetScreen.tsx` (Scoreboard-Zeilen), `RoundSection.tsx`, `AddGameScreen.tsx` (Vorschau/Bearbeiten), `sheetHtml.ts` (PDF), `groupRankingCalculator.ts` (über `totalsFor`). `bockResolver.ts` und die Spieler-ID-Felder von `Game` werden an weiteren Stellen gelesen.
- Der bestehende Import/Export (`importParser.ts`, `importDiff.ts`, `importApply.ts`, `ImportReviewScreen.tsx`, `exportTypes.ts`, `FORMAT_VERSION = 1`) arbeitet mit Envelopes `{app, formatVersion, kind, payload}`; `gameFromJson` liest Spiele, `gameSheetFromJson` Bögen.
- Das `Scoreboard` (`src/presentation/widgets/Scoreboard.tsx`) zeigt die gleiche Tabellenform wie das Papier: Punkte pro Spiel und Spieler, "—" für Aussetzer, Σ-Zeile.

## Kernänderung: Spiel mit expliziten Punkten (B)

Die App rechnet Punkte bisher aus Rohdaten. Für importierte Papierbögen gibt es diese Rohdaten nicht, also braucht ein Spiel eine **zweite Form mit expliziten Punkten pro Spieler**:

- Neues **optionales** Feld an `Game`, das die Punkte pro Spieler enthält (Spieler-ID → ganze Zahl; Aussetzer erscheint nicht oder als `null`). Ein Spiel mit diesem Feld ist ein "Punkte-Spiel"; alle anderen Spiele bleiben unverändert.
- Alte Daten, Backups und Exporte ohne das Feld funktionieren unverändert (fehlendes Feld = normales Spiel). Neue Dateien mit Punkte-Spielen werden von älteren App-Versionen nicht verstanden; `FORMAT_VERSION` und Import/Export sind entsprechend zu behandeln (Entscheidung beim Builder, siehe unten).
- Die Punkteberechnung liefert für beide Formen dieselbe Sicht: **Punkte pro Spieler** und Spiel. Für normale Spiele wird sie aus `scoreFor` abgeleitet, für Punkte-Spiele direkt gelesen. `totalsFor`, die Scoreboard-Zeilen, der PDF-Export und die Gruppen-Rangliste laufen über diese gemeinsame Sicht.
- Ein Punkte-Spiel löst **keine Bockrunde** aus, trägt keinen Bock-Bonus und zählt für `resolveBock` als normales Spiel ohne Trigger. Spiele, die Thomas später im selben Bogen normal eingibt, funktionieren weiter.
- Bearbeiten: Ein Punkte-Spiel ist nur über seine Punkte-Zellen editierbar (dasselbe Raster wie beim Erfassen), nicht über Flags/Teams. Der normale Spiel-Editor öffnet es nicht.
- Solo-Optik im Scoreboard (Ring um den Solisten) entfällt für Punkte-Spiele, außer der Builder leitet sie billig aus dem 3×-Muster ab.

## Ablauf in der App

1. **Einstieg:** neuer Eintrag im Startbildschirm/Import-Bereich, z. B. "Spielbogen von Papier erfassen". Der Nutzer wählt: **Leeres Raster** oder **KI-Abschrift verwenden**.
2. **KI-Abschrift (optional):**
   - *Prompt-Schritt:* zeigt den Prompt (de/en passend zur App-Sprache, JSON-Schlüssel immer englisch) mit der Aktion "Teilen/Kopieren".
   - *Eingabe der Antwort:* **Einfügen** in ein Textfeld oder **Datei wählen** (vorhandener `pickImportFile`). Der Parser entfernt Markdown-Codeblöcke und umgebenden Text, liest das erste JSON-Objekt und meldet konkrete Fehler (Zeilennummer, falsche Länge, falsche Spielerzahl).
3. **Raster (Kern):**
   - **Spieler zuordnen:** je Spalte ein Dropdown mit Pool-Spielern. Bei KI-Vorbelegung automatischer Match (exakt, ohne Groß-/Kleinschreibung, dann Präfix); sonst leer wählbar. Option "Neu anlegen". Jeder Pool-Spieler nur einmal. Ähnliche neue Namen (nur Groß-/Kleinschreibung/Leerzeichen) lösen eine Warnung mit Zuordnungsvorschlag aus.
   - **Tabelle** wie das Scoreboard: Zelle antippen = Wert ändern (Zahlenfeld mit Vorzeichen); Zeile hinzufügen/löschen; Aussetzer ("—") umschaltbar. 4 Spieler → kein Aussetzer; 5 Spieler → genau ein Aussetzer pro Zeile.
   - **Live-Prüfung:** Zeilensumme muss 0 sein (Aussetzer zählen 0); Zellen, die die KI als unsicher markiert hat, hervorheben. Die Spaltensummen ergeben sich immer aus den Spielen; eine Summenzeile des Papiers wird nicht übernommen. Nur wenn die KI-Abschrift eine Summenzeile mitliefert und sie von den berechneten Spaltensummen abweicht, erscheint ein **nicht blockierender Hinweis** ("Die Summen auf dem Papier stimmen rechnerisch nicht mit den Spielen überein").
   - Titel und Spieldatum (`playedAt`) sind änderbar; alle Spiele erhalten das Spieldatum des Bogens.
4. **Bestätigen:** nur möglich, wenn alle Zeilen Summe 0 haben, und die Spielerzuordnung vollständig und eindeutig ist. Dann legt die App neue Spieler im Pool an, baut den Bogen mit Punkte-Spielen und speichert ihn über die vorhandenen Repositories. Reihenfolge: erst Spieler, dann Bogen; bei Fehler eine Meldung. Danach Navigation zum neuen Bogen. Abbruch hinterlässt nichts.

## Scan-Format der KI-Abschrift

```json
{
  "app": "doppelkopf_schreiber",
  "kind": "scan",
  "formatVersion": 1,
  "title": "Dienstagsrunde",
  "playedAt": "2026-11-10",
  "players": ["Thomas", "Anna", "Ben", "Clara"],
  "games": [
    { "points": [3, 3, -3, -3] },
    { "points": [-9, 3, 3, 3] },
    { "points": [3, null, -3, -3] }
  ],
  "totals": [-3, 9, -3, -3],
  "uncertain": [{ "game": 3, "player": 1 }]
}
```

- `players`: 4 oder 5 Namen in Spaltenreihenfolge des Papiers, so geschrieben wie dort.
- `games[].points`: ganze Zahlen mit Vorzeichen in Reihenfolge von `players`; `null` = leeres Feld/Strich (Aussetzer); eine echte 0 bleibt 0. Eine eventuelle Bock-Markierung des Papiers wird **nicht** übernommen (Nicht-Ziel).
- `totals`: optional, die Summenzeile des Papiers. Wird nicht importiert, sondern nur für den nicht blockierenden Hinweis bei Abweichung verwendet.
- `uncertain`: optional, 0-basierte Indizes unsicherer Zellen.
- Der Prompt verbietet der KI, Werte zu korrigieren, zu rechnen oder fehlende Werte zu erfinden.
- Das Scan-Format hat ein eigenes Schema und einen eigenen Parser; es wird **nicht** in `parseExportFile`/`ExportKind` eingebaut.

## Ansätze (Alternativen und Entscheidung)

1. **KI schreibt das volle Export-Format / KI rekonstruiert Flags:** verworfen (UUIDs, nicht prüfbar).
2. **Teams, Gewinner und Flags aus den Punkten rekonstruieren (App-seitig):** verworfen — aufwendig und riskant (Bock-Backtracking), und bei wenigen Bögen nicht nötig.
3. **Texterkennung auf dem Gerät:** verworfen (Handschrift schlecht erkannt, native Abhängigkeiten auf Android und iOS).
4. **KI-API direkt aus der App:** verworfen (Thomas will keine KI in der App).
5. **(Gewählt) Punkte-Raster (E) als Kern, speichern als Punkte-Spiele (B), KI-Abschrift nur als optionale Vorbelegung.** Der KI-Teil ist austauschbar und kostet nur einen Parser und einen Prompt.

## Meine Entscheidungen (vom Builder überprüfbar)

- Eigenes Scan-Format statt Erweiterung des Export-Envelopes.
- Strikte Prüfung: Zeilen mit Summe ≠ 0 blockieren das Speichern; nur die Zahl korrigieren oder die Zeile löschen.
- Prompt zweisprachig (de/en), Schlüsselnamen englisch.
- Prompt weitergeben über die System-Teilen-Funktion ohne neue native Abhängigkeit (`expo-clipboard` ist nicht im Projekt); Web-Variante über die Browser-Zwischenablage, falls machbar.
- Neue Spieler werden erst beim Bestätigen angelegt; die Persistenz ist nicht transaktional.
- Die Papierbögen folgen den Punkteregeln der App; die Punkte werden aber nicht gegen Regeln geprüft, sondern nur auf Zeilensumme 0.

## Präzisierungen nach dem Builder-Check (meine Entscheidungen)

- **Papier-Summenzeile (`totals`) — Entscheidung von Thomas:** Die Spaltensummen müssen zu den Spielen passen und werden deshalb aus den Spielen berechnet. Die Summenzeile des Papiers wird nicht importiert. Weicht sie von den berechneten Summen ab, gibt es nur einen Hinweis, kein Blockieren und keinen Schalter. Zeilen mit Summe ≠ 0 blockieren weiterhin immer.
- **Spielerliste und Aussetzer:** Die Spaltenreihenfolge im Raster wird zu `GameSheet.playerIds` (4 oder 5). Bei 5 Spielern setzt jedes Punkte-Spiel `sittingOutPlayerId` aus dem Aussetzer-Eintrag der Zeile (also so, wie es auf dem Papier steht). Die App-Rotation (`nextSittingOutPlayerId`: `playerIds[Spielindex % 5]`) gilt erst für später normal eingegebene Spiele und wird nicht gegen das Papier geprüft.
- **Runden:** Die Spiele werden der Reihe nach in Runden zu je `gamesPerRound(sheet)` (4 bzw. 5) Spielen aufgeteilt (`Round.index` aufsteigend; die letzte Runde darf unvollständig sein), damit `RoundSection` und spätere normale Spiele (`currentOrNextRound`) normal funktionieren.
- **Bock bei gemischten Bögen:** Punkte-Spiele sind für `resolveBock` Spiele ohne Trigger und tragen keinen Bock-Bonus. Der Bock-Banner rechnet nur aus den normalen Spielen.
- **`FORMAT_VERSION`:** Nur Exporte, die mindestens ein Punkte-Spiel enthalten, bekommen `formatVersion = 2`; der Parser akzeptiert 1 und 2. Dadurch lehnt eine ältere App-Version solche Dateien klar ab, statt sie falsch zu lesen. Dateien ohne Punkte-Spiele bleiben `formatVersion = 1`. (Der Parser prüft heute strikt auf `=== FORMAT_VERSION`; das muss angepasst werden.)
- **Spieler anlegen:** `Player` braucht nur `playerName` (Pflicht); Vor-/Nachname sind optional. "Neu anlegen" setzt nur den Namen aus der Spaltenüberschrift. Bei Namensgleichheit (ohne Beachtung von Groß-/Kleinschreibung und Leerzeichen) mit einem Pool-Spieler oder zwischen zwei neuen Spielern erscheint eine Warnung mit Zuordnungsvorschlag.
- **Reihenfolge und `playedAt`:** Die Reihenfolge der Spiele ist die Reihenfolge in `rounds[].games`; die Anzeige "neueste zuerst" arbeitet darauf. Für Spiele ist `playedAt` = Spieldatum des Bogens + Spielindex in Sekunden, damit die Zeitstempel eindeutig und aufsteigend sind und keine Sortierung durcheinanderkommt.
- **Offen für den Builder:** ob Tests oder Validierung ein `Game` ohne `winner`/Teamdaten ablehnen; das neue Feld muss `winner` bzw. Teamdaten ersetzen oder sinnvolle Standardwerte erhalten, ohne dass normale Spiele betroffen sind.

## Dem Builder überlassen

- Genaue Form des neuen `Game`-Feldes und der gemeinsamen "Punkte pro Spieler"-Sicht; Umbau der Verbraucher (`totalsFor`, `SheetScreen`, `RoundSection`, `sheetHtml`, `groupRankingCalculator`, `AddGameScreen`/Editor-Zugang für Punkte-Spiele).
- Umgang mit `FORMAT_VERSION`/Import/Export für Dateien mit Punkte-Spielen (Version anheben vs. optionales Feld; Verhalten alter App-Versionen) und mit der Persistenz-Migration.
- Dateistruktur und Namen (Vorschlag: `src/application/import/scanParser.ts`, `src/presentation/screens/PaperSheet*.tsx`, Route in `RootStackParamList`).
- Konkreter Prompt-Wortlaut, Textfeld-/Teilen-Mechanik pro Plattform (native/Web), i18n-Texte.
- Tests (Parser, gemeinsame Punktesicht für beide Spielformen, Raster-Validierung, Spielerzuordnung, Rückwärtskompatibilität alter Daten).
- Cross-Env: reine TypeScript-Änderung; falls doch eine Dependency dazukommt, `npm ci` auf macOS nachziehen und im Commit/PR kennzeichnen (siehe CLAUDE.md).
