/**
 * Prompt fuer die externe KI, die einen Papier-Spielbogen abschreibt.
 *
 * Die Prosa enthaelt bewusst keine geschweiften Klammern, damit
 * `parseScanText` das Beispiel-JSON direkt aus dem Prompt lesen kann
 * (Test). Die JSON-Schluessel sind in beiden Sprachen englisch.
 */
const EXAMPLE = `{
  "app": "doppelkopf_schreiber",
  "kind": "scan",
  "formatVersion": 1,
  "title": "Dienstagsrunde",
  "playedAt": "2026-11-10",
  "players": ["Thomas", "Anna", "Ben", "Clara"],
  "games": [
    { "points": [3, 3, -3, -3] },
    { "points": [-9, 3, 3, 3] }
  ],
  "totals": [-6, 6, 0, 0],
  "uncertain": [{ "game": 1, "player": 0 }]
}`;

const DE = `Du bekommst das Foto eines Doppelkopf-Spielbogens (Tabelle: eine Spalte fuer die Spielnummer, je eine Spalte pro Spieler, pro Zeile die Punkte eines Spiels). Schreibe die Tabelle ab und antworte mit genau einem JSON-Objekt in diesem Format:

${EXAMPLE}

Regeln:
- Schreibe nur ab, was dort steht. Rechne nicht, korrigiere keine Werte und erfinde nichts.
- "players": die 4 oder 5 Spielernamen in der Spaltenreihenfolge des Papiers, genau so geschrieben wie dort.
- "games": ein Eintrag pro Zeile in Papierreihenfolge. "points" hat pro Spieler einen Wert in derselben Reihenfolge wie "players": ganze Zahl mit Vorzeichen (z. B. 3 oder -3). Eine echte 0 bleibt 0.
- Ein leeres Feld oder ein Strich (bei 5 Spielern: der Spieler, der in diesem Spiel aussetzt) wird null.
- "totals": die Summenzeile des Papiers, falls vorhanden, sonst weglassen. Schreibe sie ab, auch wenn sie falsch aussieht.
- "uncertain": Zellen, die du nicht sicher lesen konntest, als Liste mit "game" (Zeile, bei 0 beginnend) und "player" (Spalte, bei 0 beginnend). Weglassen, wenn alles klar ist.
- Eine Bock-Markierung auf dem Papier wird ignoriert.
- "title" und "playedAt" (YYYY-MM-DD) nur angeben, wenn sie auf dem Papier stehen.
- Antworte nur mit dem JSON-Objekt, ohne weiteren Text.`;

const EN = `You will receive a photo of a Doppelkopf score sheet (a table: one column for the game number, one column per player, one row per game with the points of that game). Transcribe the table and answer with exactly one JSON object in this format:

${EXAMPLE}

Rules:
- Transcribe only what is written. Do not calculate, do not correct values and do not invent anything.
- "players": the 4 or 5 player names in the column order of the paper, spelled exactly as written there.
- "games": one entry per row in paper order. "points" has one value per player in the same order as "players": an integer with sign (e.g. 3 or -3). A real 0 stays 0.
- An empty cell or a dash (with 5 players: the player who sits out that game) becomes null.
- "totals": the sum row of the paper if there is one, otherwise omit it. Copy it even if it looks wrong.
- "uncertain": cells you could not read with confidence, as a list with "game" (row, starting at 0) and "player" (column, starting at 0). Omit it if everything is clear.
- A Bock marking on the paper is ignored (Bock rounds are not transcribed).
- Give "title" and "playedAt" (YYYY-MM-DD) only if they are written on the paper.
- Answer with the JSON object only, without any other text.`;

export function buildScanPrompt(language: 'de' | 'en'): string {
  return language === 'en' ? EN : DE;
}
