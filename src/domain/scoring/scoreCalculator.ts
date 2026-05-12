import { type Game, WinnerSide } from '@/domain/models/game';
import { type GameSheet } from '@/domain/models/gameSheet';
import { FlagTarget, type ScoreFlag } from '@/domain/models/scoreFlag';
import { BockLevel, bockLevelBonus } from '@/domain/scoring/bockLevel';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { resolveBock } from '@/domain/scoring/bockResolver';
import { contraWon, flagByCode, reWon } from '@/domain/scoring/scoringRules';

/** Aufgeschluesseltes Punkte-Ergebnis eines einzelnen Spiels. */
export interface GameScore {
  readonly rePerPlayer: number;
  readonly contraPerPlayer: number;
}

/** Vollstaendige Punkte eines Spielbogens — Punktestand pro Spieler. */
export interface SheetScore {
  readonly totalsByPlayerId: ReadonlyMap<string, number>;
}

export function totalFor(score: SheetScore, playerId: string): number {
  return score.totalsByPlayerId.get(playerId) ?? 0;
}

/** Quersumme ueber alle Spieler im Sheet — muss immer 0 sein. */
export function crossSumSheet(score: SheetScore): number {
  let sum = 0;
  for (const v of score.totalsByPlayerId.values()) {
    sum += v;
  }
  return sum;
}

/**
 * Quersumme eines einzelnen Spiels.
 *
 * `reCount`/`contraCount` beruecksichtigen Solo-Aufstellungen (1:3) genauso
 * wie klassische 2:2-Spiele. Aussetzende Spieler tragen 0 bei und muessen
 * nicht beruecksichtigt werden.
 */
export function crossSumGame(
  score: GameScore,
  opts: { reCount?: number; contraCount?: number } = {},
): number {
  const reCount = opts.reCount ?? 2;
  const contraCount = opts.contraCount ?? 2;
  return reCount * score.rePerPlayer + contraCount * score.contraPerPlayer;
}

/**
 * Liefert den Punktestand pro Re-/Kontra-Spieler fuer ein einzelnes Spiel.
 *
 * Algorithmus:
 * 1. Basis-Flag (reWon / contraWon) anhand der Gewinnerseite implizit setzen.
 * 2. Bock-Bonus zur Sieger-Seite hinzufuegen.
 * 3. Alle Flags durchlaufen und ihren Wert auf die zugeordnete Seite addieren.
 * 4. Nettogewinn der Re-Seite = reTotal - contraTotal.
 * 5a. Klassisches Spiel (2:2): Re-Spieler +netto, Kontra-Spieler -netto.
 * 5b. Solo-Spiel (1:3): Solist +3*netto, jeder Kontra -netto.
 *
 * In beiden Faellen ist die Quersumme 0; aussetzende Spieler tragen 0 bei.
 * Der Bock-Bonus wird bereits in den Netto-Gewinn berechnet, sodass er bei
 * Soli korrekt mit 3x skaliert wird.
 */
export function scoreFor(game: Game, bockLevel: BockLevel = BockLevel.none): GameScore {
  const activeFlags: ScoreFlag[] = [];

  // Basis-Flag automatisch setzen.
  activeFlags.push(game.winner === WinnerSide.re ? reWon : contraWon);

  // Vom Nutzer ausgewaehlte Flags einsammeln, Duplikate ignorieren.
  const seen = new Set<string>([activeFlags[0]!.code]);
  for (const code of game.flagCodes) {
    if (!seen.has(code)) {
      seen.add(code);
      const flag = flagByCode(code);
      if (flag !== null && !flag.isBaseFlag) {
        activeFlags.push(flag);
      }
    }
  }

  let reTotal = 0;
  let contraTotal = 0;

  // Bock-Bonus geht an Sieger.
  if (bockLevel !== BockLevel.none) {
    if (game.winner === WinnerSide.re) {
      reTotal += bockLevelBonus(bockLevel);
    } else {
      contraTotal += bockLevelBonus(bockLevel);
    }
  }

  for (const f of activeFlags) {
    switch (f.target) {
      case FlagTarget.reSide:
        reTotal += f.value;
        break;
      case FlagTarget.contraSide:
        contraTotal += f.value;
        break;
      case FlagTarget.winner:
        if (game.winner === WinnerSide.re) reTotal += f.value;
        else contraTotal += f.value;
        break;
      case FlagTarget.loser:
        if (game.winner === WinnerSide.re) contraTotal += f.value;
        else reTotal += f.value;
        break;
    }
  }

  const net = reTotal - contraTotal;
  // `-net` ergibt bei net === 0 in JS negative Null, was Jest's `toBe`
  // (Object.is) von positiver Null unterscheidet — daher explizit auf 0
  // normalisieren.
  const negNet = net === 0 ? 0 : -net;
  if (game.isSolo) {
    // Solist (1) bekommt 3*net, jeder Kontra-Spieler (3) -net.
    // Quersumme: 1*3*net + 3*(-net) = 0.
    return { rePerPlayer: 3 * net, contraPerPlayer: negNet };
  }
  return { rePerPlayer: net, contraPerPlayer: negNet };
}

/**
 * Aggregierte Punkte pro Spieler ueber den gesamten Spielbogen.
 *
 * `mode` steuert, wie gestapelte Bock-Trigger verrechnet werden
 * (Standard: `BockStackingMode.sequential`).
 */
export function totalsFor(
  sheet: GameSheet,
  mode: BockStackingMode = BockStackingMode.sequential,
): SheetScore {
  const totals = new Map<string, number>();
  for (const id of sheet.playerIds) {
    totals.set(id, 0);
  }

  const levels = resolveBock(sheet, mode);

  for (const round of sheet.rounds) {
    for (const game of round.games) {
      const level = levels.get(game.id) ?? BockLevel.none;
      const score = scoreFor(game, level);
      for (const id of game.rePlayerIds) {
        totals.set(id, (totals.get(id) ?? 0) + score.rePerPlayer);
      }
      for (const id of game.contraPlayerIds) {
        totals.set(id, (totals.get(id) ?? 0) + score.contraPerPlayer);
      }
      // Aussetzender Spieler (5er): bekommt nichts.
    }
  }

  return { totalsByPlayerId: totals };
}
