import type { AppSettings } from '@/domain/models/appSettings';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { SheetGroup } from '@/domain/models/sheetGroup';

export const APP_TAG = 'doppelkopf_schreiber';
export const FORMAT_VERSION = 1;

export type ExportKind = 'sheet' | 'group' | 'backup';

export interface ExportPayload {
  readonly players: ReadonlyArray<Player>;
  readonly sheets: ReadonlyArray<GameSheet>;
  readonly groups: ReadonlyArray<SheetGroup>;
  readonly settings: AppSettings | null;
}

export interface ExportEnvelope {
  readonly app: typeof APP_TAG;
  readonly formatVersion: typeof FORMAT_VERSION;
  readonly kind: ExportKind;
  readonly exportedAt: string;
  readonly exportedFromAppVersion: string;
  readonly payload: ExportPayload;
}

export interface ExportFile {
  readonly envelope: ExportEnvelope;
  readonly suggestedFilename: string;
}
