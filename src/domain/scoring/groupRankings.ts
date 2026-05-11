/** Ein Eintrag in einer Rangliste — ein Spieler mit Wert und Rang. */
export interface RankingEntry {
  /** Spieler-ID (zur stabilen Identifikation ueber Spielboegen hinweg). */
  readonly playerId: string;
  /**
   * Anzeigename, zum Render-Zeitpunkt aufgeloest — der Calculator nimmt den
   * Namen aus dem ersten Spielbogen, in dem der Spieler auftaucht. So
   * braucht der Service kein Player-Repository.
   */
  readonly displayName: string;
  /** Wert in der Rangliste — Platzierungspunkte / Punktesumme / Soli. */
  readonly value: number;
  /**
   * 1-basierter Rang, geteilte Raenge bei Gleichstand
   * (Standard-Competition-Ranking: 1, 1, 3, 4 …).
   */
  readonly rank: number;
}

/**
 * Drei Ranglisten einer Gruppe — gemeinsam zurueckgegeben, weil sie aus
 * derselben Iteration ueber die Spielboegen entstehen.
 */
export interface GroupRankings {
  /**
   * Platzierungs-Punkte pro Spieler, summiert ueber alle Spielboegen.
   * Pro Bogen bekommt der erste den Wert N (Anzahl Spieler), der letzte 1.
   * Bei Punktegleichstand auf einem Bogen erhalten alle Tied-Spieler den
   * hoeheren Rang (Standard Competition Ranking).
   */
  readonly placementPoints: ReadonlyArray<RankingEntry>;
  /** Summe der Spielpunkte pro Spieler ueber alle Spielboegen, absteigend. */
  readonly totalPoints: ReadonlyArray<RankingEntry>;
  /**
   * Anzahl gewonnener Solo-Spiele pro Spieler. Ein Solo zaehlt nur, wenn der
   * Solist (einziger Re-Spieler) auch der Sieger ist. Verlorene Soli
   * werden nicht erfasst.
   */
  readonly wonSoli: ReadonlyArray<RankingEntry>;
}

export const groupRankingsEmpty: GroupRankings = {
  placementPoints: [],
  totalPoints: [],
  wonSoli: [],
};
