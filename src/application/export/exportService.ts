import Constants from 'expo-constants';

import { repositories } from '@/application/stores/repositories';
import {
  APP_TAG,
  FORMAT_VERSION,
  type ExportEnvelope,
  type ExportFile,
  type ExportKind,
  type ExportPayload,
} from '@/application/export/exportTypes';
import { suggestFilename } from '@/application/export/filename';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function appVersion(): string {
  const v = Constants.expoConfig?.version;
  return typeof v === 'string' ? v : 'unknown';
}

function envelope(
  kind: ExportKind,
  payload: ExportPayload,
  exportedAt: Date,
): ExportEnvelope {
  return {
    app: APP_TAG,
    formatVersion: FORMAT_VERSION,
    kind,
    exportedAt: exportedAt.toISOString(),
    exportedFromAppVersion: appVersion(),
    payload,
  };
}

export async function exportSheet(sheetId: string): Promise<ExportFile> {
  const sheet = await repositories.gameSheet().load(sheetId);
  if (sheet === null) {
    throw new Error(`Spielbogen nicht gefunden: ${sheetId}`);
  }
  const referencedIds = new Set(sheet.playerIds);
  const pool = await repositories.player().loadAll();
  const players = pool.filter((p) => referencedIds.has(p.id));

  const now = new Date();
  return {
    envelope: envelope(
      'sheet',
      { players, sheets: [sheet], groups: [], settings: null },
      now,
    ),
    suggestedFilename: suggestFilename(sheet.title ?? '', isoDate(now)),
  };
}

export async function exportGroup(groupId: string): Promise<ExportFile> {
  const group = await repositories.sheetGroup().load(groupId);
  if (group === null) {
    throw new Error(`Gruppe nicht gefunden: ${groupId}`);
  }
  const allSheets = await repositories.gameSheet().loadAll();
  const sheets = allSheets.filter((s) => s.groupId === groupId);

  const referencedIds = new Set<string>();
  for (const s of sheets) {
    for (const id of s.playerIds) referencedIds.add(id);
  }
  const pool = await repositories.player().loadAll();
  const players = pool.filter((p) => referencedIds.has(p.id));

  const now = new Date();
  return {
    envelope: envelope(
      'group',
      { players, sheets, groups: [group], settings: null },
      now,
    ),
    suggestedFilename: suggestFilename(group.name, isoDate(now)),
  };
}

export async function exportBackup(): Promise<ExportFile> {
  const [players, groups, sheets, settings] = await Promise.all([
    repositories.player().loadAll(),
    repositories.sheetGroup().loadAll(),
    repositories.gameSheet().loadAll(),
    repositories.settings().load(),
  ]);

  const now = new Date();
  return {
    envelope: envelope(
      'backup',
      { players, sheets, groups, settings },
      now,
    ),
    suggestedFilename: suggestFilename('backup', isoDate(now)),
  };
}
