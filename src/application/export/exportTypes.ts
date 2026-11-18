import type { AppSettings } from '@/domain/models/appSettings';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { SheetGroup } from '@/domain/models/sheetGroup';

import { isPointsGame } from '@/domain/models/game';

export const APP_TAG = 'doppelkopf_schreiber';
export const FORMAT_VERSION = 1;
/** Dateien mit mindestens einem Punkte-Spiel (Papier-Import). */
export const FORMAT_VERSION_POINTS_GAMES = 2;
export const SUPPORTED_FORMAT_VERSIONS: readonly number[] = [
  FORMAT_VERSION,
  FORMAT_VERSION_POINTS_GAMES,
];

/**
 * Welche formatVersion ein Export braucht: 2, sobald ein Punkte-Spiel
 * enthalten ist (aeltere App-Versionen lehnen die Datei dann klar ab),
 * sonst 1.
 */
export function formatVersionFor(sheets: readonly GameSheet[]): number {
  for (const sheet of sheets) {
    for (const round of sheet.rounds) {
      if (round.games.some(isPointsGame)) return FORMAT_VERSION_POINTS_GAMES;
    }
  }
  return FORMAT_VERSION;
}

export type ExportKind = 'sheet' | 'group' | 'backup';

export interface ExportPayload {
  readonly players: readonly Player[];
  readonly sheets: readonly GameSheet[];
  readonly groups: readonly SheetGroup[];
  readonly settings: AppSettings | null;
}

export interface ExportEnvelope {
  readonly app: typeof APP_TAG;
  readonly formatVersion: number;
  readonly kind: ExportKind;
  readonly exportedAt: string;
  readonly exportedFromAppVersion: string;
  readonly payload: ExportPayload;
}

export interface ExportFile {
  readonly envelope: ExportEnvelope;
  readonly suggestedFilename: string;
}
