# Ersatzspieler (Vertretung) in der Saisonwertung — Design

Stand: 2026-11-17 · Umfang: kleine Änderung (Kurz-Design)

## Absicht

Innerhalb einer Saison wird ein Stammspieler an einem Abend manchmal durch einen
sonst nicht mitspielenden Gast vertreten. Der Gast spielt "im Namen" des
Stammspielers. Seine **Platzierungspunkte** dieses Spielbogens sollen dem
Stammspieler in der Saisonwertung gutgeschrieben werden koennen.

## Ziele

- Pro Spielbogen optional erfassen: "Gast X vertritt Stammspieler Y" (auch mehrere Paare).
- Saisonuebersicht ([GroupRankingsScreen](../../../src/presentation/screens/GroupRankingsScreen.tsx))
  bekommt einen Schalter **"Vertretungen einrechnen"**:
  - **Aus** (Default): Verhalten wie heute.
  - **An**: Der Stammspieler erhaelt die Platzierungspunkte des Gastes fuer diesen
    Bogen **zusaetzlich**. Der Gast behaelt seine eigenen Platzierungspunkte auch in
    dieser Ansicht (Entscheidung: Schalter aendert nur die Stammspieler-Zeile).

## Nicht-Ziele

- Spielpunkte gesamt und gewonnene Soli bleiben unveraendert beim tatsaechlich
  spielenden Gast — in beiden Schalterstellungen.
- Keine Vertretung pro Spiel (Wechsel mitten am Abend).
- Keine saisonweite Zuordnung "Gast vertritt immer Y".
- Der Spielbogen selbst (Tabelle, Summen, PDF) zeigt weiter den Gast; hoechstens ein
  dezenter Hinweis "vertritt Y".

## Ansaetze

1. **Am Spielbogen (gewaehlt).** Optionale Zuordnung Gast → Stammspieler pro Bogen.
   Passt zu "an diesem Abend vertritt X den Y"; derselbe Gast kann an anderen Abenden
   andere vertreten. Kostet ein neues, rueckwaertskompatibles Feld im Bogen-JSON.
2. An der Saison (Gast vertritt immer Y) — verworfen, bricht sobald ein Gast
   verschiedene Leute vertritt.
3. Pro Spiel — verworfen, nicht benoetigt und deutlich aufwendiger.

## Entscheidungen zum Wie

- **Modell:** `GameSheet.substitutions: readonly { substituteId: string; mainPlayerId: string }[]`
  (Default `[]`). `gameSheetFromJson` liest fehlendes Feld als `[]`; `copyGameSheet`
  bekommt ein Patch-Feld.
- **Validierung:** `substituteId` muss in `playerIds` des Bogens sein; `mainPlayerId`
  darf **nicht** in `playerIds` sein (sonst doppelte Punkte fuer einen Abend); jeder
  Gast und jeder Stammspieler hoechstens einmal pro Bogen.
- **Berechnung:** `calculateGroupRankings` bekommt `applySubstitutions: boolean`.
  Bei `true` werden nach der Platzierungsvergabe pro Bogen die Punkte jedes Gastes
  zusaetzlich auf den Stammspieler addiert. Der Name des Stammspielers kommt ueber
  den `PlayerLookup`. Spielpunkte/Soli unberuehrt.
- **Erfassung (UI):** im Optionsbereich des Spielbogens ([SheetScreen](../../../src/presentation/screens/SheetScreen.tsx)),
  analog zu Saison-Zuordnung und Bock-Modus: Dialog "Vertretungen" mit Paaren
  Gast (aus Bogen-Spielern) → Stammspieler (aus Pool, ohne Bogen-Spieler).
  Nur sichtbar/aktiv, wenn der Bogen einer Gruppe zugeordnet ist.
- **Schalter:** lokaler UI-State im Ranking-Screen, Default aus, nicht persistiert.
- **Mitziehen, weil Spieler-IDs referenziert werden:**
  - [playerUsage.ts](../../../src/application/playerUsage.ts): Stammspieler einer
    Vertretung gilt als referenziert (nicht loeschbar).
  - [exportService.ts](../../../src/application/export/exportService.ts): Stammspieler
    in die exportierten Spieler aufnehmen.
  - [importApply.ts](../../../src/application/import/importApply.ts) /
    [importDiff.ts](../../../src/application/import/importDiff.ts): IDs in
    `substitutions` wie `playerIds` remappen bzw. beim Blocken beruecksichtigen.
- **i18n:** neue Texte in de und en.

## Dem Umsetzer ueberlassen

- Genaue Gestaltung des Vertretungs-Dialogs und des Hinweises auf dem Bogen.
- Ob die Erfassung zusaetzlich schon beim Anlegen des Bogens angeboten wird
  (optional, nicht noetig).
- Kennzeichnung im Ranking, dass ein Wert Vertretungspunkte enthaelt (nice-to-have).

## Tests

- Calculator: Schalter aus = bisheriges Ergebnis; Schalter an = Stammspieler +N,
  Gast unveraendert; Spielpunkte/Soli identisch in beiden Modi; Stammspieler ohne
  eigene Boegen erscheint mit Vertretungspunkten.
- JSON-Roundtrip mit und ohne `substitutions`; Import-Remap; Player-Usage.
