import { appSettingsFromJson, type AppSettings } from '@/domain/models/appSettings';
import { gameSheetFromJson } from '@/domain/models/gameSheet';
import { playerFromJson } from '@/domain/models/player';
import { sheetGroupFromJson } from '@/domain/models/sheetGroup';
import {
  APP_TAG,
  FORMAT_VERSION,
  type ExportEnvelope,
  type ExportKind,
} from '@/application/export/exportTypes';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export interface ParsedExportFile {
  readonly envelope: ExportEnvelope;
}

export function parseExportFile(rawText: string): ParsedExportFile {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch (e) {
    throw new ParseError(`Datei ist kein gueltiges JSON: ${(e as Error).message}`);
  }
  if (!isObject(json)) {
    throw new ParseError('Datei ist kein JSON-Objekt.');
  }
  if (json['app'] !== APP_TAG) {
    throw new ParseError(
      `Unbekanntes app-Feld: ${String(json['app'])} (erwartet ${APP_TAG}).`,
    );
  }
  if (json['formatVersion'] !== FORMAT_VERSION) {
    throw new ParseError(
      `Unbekannte formatVersion: ${String(json['formatVersion'])} (erwartet ${FORMAT_VERSION}).`,
    );
  }
  const kind = json['kind'];
  if (kind !== 'sheet' && kind !== 'group' && kind !== 'backup') {
    throw new ParseError(`Unbekanntes kind-Feld: ${String(kind)}.`);
  }
  const payload = json['payload'];
  if (!isObject(payload)) {
    throw new ParseError('Payload fehlt oder ist kein Objekt.');
  }

  const players = readArray(payload['players']).map(playerFromJson);
  const sheets = readArray(payload['sheets']).map(gameSheetFromJson);
  const groups = readArray(payload['groups']).map(sheetGroupFromJson);
  const settings = readSettings(payload['settings']);

  validatePerKind(kind, {
    sheets: sheets.length,
    groups: groups.length,
    hasSettings: settings !== null,
  });

  const exportedAt =
    typeof json['exportedAt'] === 'string' ? json['exportedAt'] : new Date(0).toISOString();
  const exportedFromAppVersion =
    typeof json['exportedFromAppVersion'] === 'string'
      ? json['exportedFromAppVersion']
      : 'unknown';

  return {
    envelope: {
      app: APP_TAG,
      formatVersion: FORMAT_VERSION,
      kind,
      exportedAt,
      exportedFromAppVersion,
      payload: { players, sheets, groups, settings },
    },
  };
}

function validatePerKind(
  kind: ExportKind,
  counts: { sheets: number; groups: number; hasSettings: boolean },
): void {
  switch (kind) {
    case 'sheet':
      if (counts.sheets !== 1)
        throw new ParseError(
          `kind=sheet muss genau einen Bogen enthalten, hat ${counts.sheets}.`,
        );
      if (counts.groups !== 0)
        throw new ParseError(
          `kind=sheet darf keine Gruppen enthalten, hat ${counts.groups}.`,
        );
      if (counts.hasSettings)
        throw new ParseError('kind=sheet darf keine Settings enthalten.');
      break;
    case 'group':
      if (counts.groups !== 1)
        throw new ParseError(
          `kind=group muss genau eine Gruppe enthalten, hat ${counts.groups}.`,
        );
      if (counts.hasSettings)
        throw new ParseError('kind=group darf keine Settings enthalten.');
      break;
    case 'backup':
      if (!counts.hasSettings) throw new ParseError('kind=backup muss Settings enthalten.');
      break;
  }
}

function readArray(v: unknown): ReadonlyArray<Record<string, unknown>> {
  if (!Array.isArray(v)) return [];
  return v.filter((entry): entry is Record<string, unknown> => isObject(entry));
}

function readSettings(v: unknown): AppSettings | null {
  if (!isObject(v)) return null;
  return appSettingsFromJson(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
