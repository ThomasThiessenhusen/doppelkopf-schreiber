import { WinnerSide } from '@/domain/models/game';
import { allGames, totalGames, type GameSheet } from '@/domain/models/gameSheet';
import { playerDisplayName } from '@/domain/models/player';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { effectiveStackingMode } from '@/domain/scoring/bockResolver';
import {
  groupRankingsEmpty,
  type GroupRankings,
  type RankingEntry,
} from '@/domain/scoring/groupRankings';
import { totalsFor } from '@/domain/scoring/scoreCalculator';

export interface CalculateGroupRankingsInput {
  sheets: ReadonlyArray<GameSheet>;
  defaultMode: BockStackingMode;
}

/**
 * Aggregiert pro Gruppe drei Ranglisten: Platzierungspunkte, Spielpunkte
 * gesamt und gewonnene Soli. Reine Funktion — kein I/O, kein Repository.
 *
 * `defaultMode` ist der App-Default fuer den Bockrunden-Stapelmodus. Pro
 * Sheet wird ueber `effectiveStackingMode` der Per-Sheet-Override (falls
 * gesetzt) aufgeloest — so liefert die Rangliste dieselben Punktestaende
 * wie die Einzel-Sheet-Ansicht.
 */
export function calculateGroupRankings(input: CalculateGroupRankingsInput): GroupRankings {
  const { sheets, defaultMode } = input;
  if (sheets.length === 0) return groupRankingsEmpty;

  const placement = new Map<string, number>();
  const points = new Map<string, number>();
  const wonSoli = new Map<string, number>();
  const names = new Map<string, string>();

  for (const sheet of sheets) {
    // Sheet ohne Spiele: leise ueberspringen.
    if (totalGames(sheet) === 0) continue;

    const mode = effectiveStackingMode(sheet, defaultMode);
    const totals = totalsFor(sheet, mode);

    // Display-Namen aus dem ersten Bogen merken, in dem der Spieler auftaucht.
    for (const player of sheet.players) {
      if (!names.has(player.id)) {
        names.set(player.id, playerDisplayName(player));
      }
    }

    // Aktive Spieler dieses Bogens ermitteln.
    const activeIds = new Set<string>();
    for (const game of allGames(sheet)) {
      for (const id of game.rePlayerIds) activeIds.add(id);
      for (const id of game.contraPlayerIds) activeIds.add(id);
    }
    if (activeIds.size === 0) continue;

    // Per-Sheet-Punktestaende ermitteln und aufsummieren.
    const candidates = new Map<string, number>();
    for (const id of activeIds) {
      const value = totals.totalsByPlayerId.get(id) ?? 0;
      candidates.set(id, value);
      points.set(id, (points.get(id) ?? 0) + value);
      if (!wonSoli.has(id)) wonSoli.set(id, 0);
    }

    // Gewonnene Soli zaehlen: Solist == einziger Re-Spieler, Sieger Re.
    for (const game of allGames(sheet)) {
      if (game.isSolo && game.winner === WinnerSide.re && game.rePlayerIds.length > 0) {
        const soloistId = game.rePlayerIds[0]!;
        wonSoli.set(soloistId, (wonSoli.get(soloistId) ?? 0) + 1);
      }
    }

    // Platzierungspunkte: Standard Competition Ranking.
    const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]);
    const n = sorted.length;
    let rank = 0;
    let lastValue: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const [id, value] = sorted[i]!;
      if (value !== lastValue) {
        rank = i + 1;
        lastValue = value;
      }
      const pts = n - rank + 1;
      placement.set(id, (placement.get(id) ?? 0) + pts);
    }
  }

  return {
    placementPoints: toRanked(placement, names),
    totalPoints: toRanked(points, names),
    wonSoli: toRanked(wonSoli, names),
  };
}

/**
 * Sortiert eine Wert-Map absteigend und vergibt Standard-Competition-
 * Ranking-Raenge (gleicher Wert -> gleicher Rang, naechster Rang springt
 * entsprechend).
 */
function toRanked(
  values: ReadonlyMap<string, number>,
  names: ReadonlyMap<string, string>,
): ReadonlyArray<RankingEntry> {
  const entries = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const result: RankingEntry[] = [];
  let rank = 0;
  let lastValue: number | null = null;
  for (let i = 0; i < entries.length; i++) {
    const [playerId, value] = entries[i]!;
    if (value !== lastValue) {
      rank = i + 1;
      lastValue = value;
    }
    result.push({
      playerId,
      displayName: names.get(playerId) ?? playerId,
      value,
      rank,
    });
  }
  return result;
}
