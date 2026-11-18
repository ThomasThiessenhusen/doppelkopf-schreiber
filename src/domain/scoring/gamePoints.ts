import { allGames, type GameSheet } from '@/domain/models/gameSheet';
import { BockLevel } from '@/domain/scoring/bockLevel';
import { resolveBock } from '@/domain/scoring/bockResolver';
import { type BockStackingMode } from '@/domain/scoring/bockStackingMode';

import { gamePointsByPlayer } from '@/domain/scoring/scoreCalculator';

export { gamePointsByPlayer };

/** Eine Zeile der Punktetabelle eines Bogens (Scoreboard, PDF). */
export interface GameRow {
  readonly gameId: string;
  readonly pointsByPlayerId: ReadonlyMap<string, number>;
  readonly sittingOutPlayerId: string | null;
  readonly bockLevel: BockLevel;
  readonly soloPlayerId: string | null;
}

/** Zeilen pro Spiel in der Reihenfolge von `allGames(sheet)`. */
export function gameRowsFor(sheet: GameSheet, mode: BockStackingMode): readonly GameRow[] {
  const levels = resolveBock(sheet, mode);
  const rows: GameRow[] = [];
  for (const game of allGames(sheet)) {
    const level = levels.get(game.id) ?? BockLevel.none;
    rows.push({
      gameId: game.id,
      pointsByPlayerId: gamePointsByPlayer(game, level),
      sittingOutPlayerId: game.sittingOutPlayerId,
      bockLevel: level,
      soloPlayerId: game.isSolo ? (game.rePlayerIds[0] ?? null) : null,
    });
  }
  return rows;
}
