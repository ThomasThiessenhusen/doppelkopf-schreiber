# Handgeschriebene Spielbögen importieren

Für den seltenen Fall, dass ein Abend auf Papier mitgeschrieben wurde und nachträglich in
Bockzettel landen soll. Die App selbst braucht dafür nichts Neues: Eine KI (z. B. Claude auf
claude.ai) liest das Foto und erzeugt eine Datei im Bockzettel-Exportformat, die du über den
normalen Import einliest.

## Ablauf

1. **Foto machen.** Zettel gerade, gut ausgeleuchtet, alle Spalten lesbar. Bei mehreren Seiten
   alle Fotos.
2. **Chat öffnen** (claude.ai oder eine andere KI mit Bildverständnis), die Fotos hochladen und
   den kompletten [Prompt unten](#prompt-zum-kopieren) hineinkopieren. Platzhalter in `‹…›`
   vorher ausfüllen.
3. **Rückfragen beantworten.** Die KI listet unklare Stellen auf, statt zu raten.
4. **Gegenlesen** mit der [Checkliste](#checkliste-zum-gegenlesen) — vor allem die
   Endstände-Tabelle, die die KI mitliefert.
5. **Datei speichern** als `bockzettel-papier-JJJJ-MM-TT.json` (Inhalt des JSON-Blocks, nichts
   davor oder dahinter).
6. **Importieren:** *Einstellungen → Import → Datei auswählen*. Die Import-Vorschau zeigt
   Spieler und Bogen. Spieler mit gleichem Namen wie in der App werden automatisch zugeordnet
   („zusammenführen") — achte darauf, dass dort keine Doppelten neu angelegt werden.
7. **Saison zuordnen:** Bogen öffnen → Menü → *Gruppe zuordnen…*. Danach stimmen Bogen und
   Saisonwertung.

Ein fertiges Beispiel für das Ergebnis: [handschrift-import-beispiel.json](handschrift-import-beispiel.json)
(4 Spieler, 4 Spiele, mit Ansage, verlorener Ansage → Bock, Solo, Fuchs). Ein automatischer
Test prüft, dass genau diese Datei importierbar ist und
Anna +9, Ben +13, Carla −7, Dirk −15 ergibt.

---

## Prompt zum Kopieren

````text
Du bekommst Fotos eines handgeschriebenen Doppelkopf-Spielbogens. Wandle ihn in EINE Datei
im Exportformat der App „Bockzettel" um. Rate nicht: Wenn etwas unleserlich oder mehrdeutig
ist, frag mich zuerst und erzeuge die Datei erst nach meiner Antwort.

Rahmendaten (von mir):
- Datum des Abends: ‹JJJJ-MM-TT›
- Spielernamen genau so, wie sie in der App heißen: ‹Name1, Name2, Name3, Name4[, Name5]›
  (Sitzreihenfolge = Reihenfolge der Spalten auf dem Zettel)
- Bock-Modus an diesem Abend: ‹sequential | doppelbock | off›
  (sequential = Bockrunden laufen nacheinander; doppelbock = überlappende Bockrunden zählen
  doppelt; off = ohne Bock)
- Besonderheiten der Notation auf dem Zettel (falls bekannt): ‹z. B. „S“ = Solo, Kreis = Bock›

## Ausgabe

1. Zuerst eine Tabelle: Spiel-Nr. | Re | Kontra | Sieger | Ansagen/Sonderpunkte | Punkte laut
   Zettel | Punkte laut Regeln unten | ✓/✗
2. Darunter die Endstände je Spieler: laut Zettel und laut Regeln.
3. Dann die Datei als EIN ```json-Codeblock. Nichts anderes im Codeblock.

## Dateiformat (exakt einhalten)

{
  "app": "doppelkopf_schreiber",
  "formatVersion": 1,
  "kind": "sheet",
  "exportedAt": "<Datum>T23:00:00.000Z",
  "exportedFromAppVersion": "handschrift-import",
  "payload": {
    "players": [ { "id": "hs-<name-klein>", "playerName": "<Name exakt>" }, ... ],
    "sheets": [ {
      "id": "hs-<Datum>",
      "title": "Abend <TT.MM.JJJJ> (Papier)",
      "createdAt": "<Datum>T19:00:00.000Z",
      "updatedAt": "<Datum>T23:00:00.000Z",
      "playerIds": [ <Spieler-IDs in Sitzreihenfolge, 4 oder 5> ],
      "dirty": false,
      "stackingModeOverride": "<Bock-Modus>",
      "groupId": null,
      "substitutions": [],
      "rounds": [ { "index": 0, "games": [ <Spiel>, ... ] }, { "index": 1, ... } ]
    } ],
    "groups": [],
    "settings": null
  }
}

Spiel:
{
  "id": "hs-<Datum>-g<NN>",            // fortlaufend g01, g02, …
  "playedAt": "<Datum>T19:<MM>:00.000Z", // aufsteigend, z. B. 10 Minuten Abstand (über 60 Min. → Stunde erhöhen)
  "rePlayerIds": [ ... ],               // Normalspiel: 2 IDs; Solo: genau 1 ID (der Solist)
  "contraPlayerIds": [ ... ],           // Normalspiel: 2 IDs; Solo: 3 IDs
  "sittingOutPlayerId": null,           // bei 5 Spielern: ID des Aussetzenden, sonst null
  "winner": "re" | "contra",
  "flagCodes": [ ... ],                 // nur Codes aus der Liste unten
  "note": null,                         // oder kurzer Text, z. B. "Damensolo"
  "isSolo": false | true,
  "triggersManualBock": false           // true nur, wenn auf dem Zettel ausdrücklich
                                        // ein Bock „ausgerufen" wurde, der sich nicht aus
                                        // den Regeln unten ergibt
}

Runden: Eine Runde hat so viele Spiele wie Spieler (4 oder 5). Spiel 1–4 → Runde index 0,
Spiel 5–8 → index 1 usw. (bei 5 Spielern je 5). Die letzte Runde darf kürzer sein.
Kommentare (//) gehören NICHT in die Ausgabe — gültiges JSON erzeugen.

## Ansagen und Sonderpunkte (flagCodes)

Die Basis (Re gewinnt +1, Kontra gewinnt +2 „gegen die Alten") ergibt sich aus "winner" —
NICHT als Code eintragen.

Ansagen (Punkte gehen an die siegreiche Partei):
- reAnnounced (+2) · contraAnnounced (+2)
- reAnnouncedUnder90, reAnnouncedUnder60, reAnnouncedUnder30, reAnnouncedSchwarz (je +1)
- contraAnnouncedUnder90, contraAnnouncedUnder60, contraAnnouncedUnder30, contraAnnouncedSchwarz (je +1)

Erreicht (Punkte gehen an die siegreiche Partei; die Verlierer blieben unter X):
- under90, under60, under30, schwarz (je +1; „unter 60" bedeutet under90 UND under60)

Sonderpunkte der Re-Partei (je +1 für Re, egal wer gewinnt):
- reKarlchen (Karlchen letzter Stich), reKarlchenGefangen, reDulleGefangen,
  reFuchsLetzterStich, reFuchs1 / reFuchs2 (ein / zwei Füchse gefangen),
  reDoppelkopf1 … reDoppelkopf4 (Anzahl Doppelköpfe)
Sonderpunkte der Kontra-Partei (je +1 für Kontra): dieselben mit Präfix contra…
  (contraKarlchen, contraKarlchenGefangen, contraDulleGefangen, contraFuchsLetzterStich,
  contraFuchs1, contraFuchs2, contraDoppelkopf1 … contraDoppelkopf4)
Pro Gruppe nur EIN Code: also reFuchs2 statt zweimal reFuchs1.

## Punkte-Regeln zur Selbstkontrolle

- Re-Summe = (1 falls Re gewinnt) + Sonderpunkte Re + (Ansagen/Erreicht, falls Re gewinnt)
  + Bock-Bonus (falls Re gewinnt).
- Kontra-Summe analog, Basis 2 statt 1.
- netto = Re-Summe − Kontra-Summe.
- Normalspiel: jeder Re-Spieler +netto, jeder Kontra-Spieler −netto.
- Solo: Solist +3×netto, jeder der drei Gegner −netto.
- Aussetzender (5 Spieler): 0.
- Bock: Ein Spiel löst eine Bockrunde aus, wenn eine Ansage verloren wurde (reAnnounced und
  Kontra gewinnt, oder contraAnnounced und Re gewinnt) oder triggersManualBock true ist.
  Die Bockrunde beginnt mit dem NÄCHSTEN Spiel und dauert so viele Spiele, wie Spieler am
  Tisch sind. Bock-Bonus: +2 für die siegreiche Partei. Im Modus doppelbock zählen
  überlappende Bockrunden +4; im Modus sequential laufen sie nacheinander; im Modus off gibt
  es keinen Bock.

Wenn deine berechneten Punkte nicht zu den Punkten auf dem Zettel passen: markiere das Spiel
mit ✗ und nenne die wahrscheinlichste Ursache (übersehene Ansage, falscher Sieger, Bock).
Ändere die Daten NICHT eigenmächtig, damit sie passen — frag mich.
````

---

## Checkliste zum Gegenlesen

- [ ] Alle Spiele des Zettels sind in der Tabelle, keines doppelt.
- [ ] Jede Zeile hat ✓. Ein ✗ ist geklärt (Rückfrage beantwortet), nicht übergangen.
- [ ] Endstände laut Regeln = Endstände laut Zettel, Summe aller Spieler = 0.
- [ ] Spielernamen exakt wie in der App (Groß-/Kleinschreibung egal, Schreibweise nicht).
- [ ] Bei 5 Spielern: Aussetzer pro Spiel plausibel.
- [ ] Bock-Modus stimmt mit dem Abend überein — sonst weichen die Punkte nach Bockrunden ab.

## Wenn der Import meckert

| Meldung (gekürzt) | Ursache | Abhilfe |
|---|---|---|
| „Datei ist kein gültiges JSON" | Text vor/nach dem Codeblock mitkopiert oder Kommentare `//` im JSON | Nur den Inhalt des JSON-Blocks speichern; KI bitten, „gültiges JSON ohne Kommentare" zu liefern |
| „Unbekanntes app-Feld" / „Unbekannte formatVersion" | Kopf der Datei falsch | `"app": "doppelkopf_schreiber"`, `"formatVersion": 1` |
| „kind=sheet muss genau einen Bogen enthalten" | Mehrere Abende in einer Datei | Pro Abend eine Datei |
| „GameSheet.playerIds muss 4 oder 5 Einträge haben" | Spielerliste im Bogen unvollständig | Alle Spieler-IDs in `playerIds` |
| Import klappt, aber Punkte im Bogen weichen vom Zettel ab | Falscher Bock-Modus, Solo mit 2:2 (bzw. Normalspiel mit 1:3) oder vergessene Ansage — der Import prüft die Aufstellung nicht | Endstände-Tabelle der KI mit dem Bogen vergleichen; `stackingModeOverride`, `isSolo` und Re/Kontra-Anzahl prüfen. Korrigieren geht danach auch direkt in der App (Spiel antippen) |
| Spieler erscheint doppelt nach Import | Name weicht von der App ab (z. B. „Tom" vs. „Thomas") | In der Import-Vorschau den neuen Spieler auf den vorhandenen umstellen |
