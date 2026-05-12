import type { LocalStorage } from '@/data/local/localStorage';

const FLAG_COLLECTION = '_migration';
const FLAG_ID = 'schema_v2';

const SHEETS = 'game_sheets';
const PLAYERS = 'players';

/**
 * Konvertiert Spielboegen mit eingebetteten `players`-Snapshots in die neue
 * `playerIds`-Form und stellt sicher, dass jeder Snapshot im Pool existiert.
 * Idempotent durch ein Flag in einer eigenen Collection (`_migration/schema_v2`).
 */
export async function runV2Migration(storage: LocalStorage): Promise<void> {
  const existingFlag = await storage.readOne(FLAG_COLLECTION, FLAG_ID);
  if (existingFlag !== null) return;

  const pool = await storage.readAll(PLAYERS);
  const poolIds = new Set<string>();
  for (const entry of pool) {
    const id = entry['id'];
    if (typeof id === 'string') poolIds.add(id);
  }

  const sheets = await storage.readAll(SHEETS);
  for (const raw of sheets) {
    const sheetId = raw['id'];
    if (typeof sheetId !== 'string') continue;
    if (Array.isArray(raw['playerIds'])) continue;

    const legacy = raw['players'];
    if (!Array.isArray(legacy)) continue;

    const ids: string[] = [];
    for (const entry of legacy) {
      if (entry === null || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const pid = obj['id'];
      if (typeof pid !== 'string') continue;
      ids.push(pid);
      if (!poolIds.has(pid)) {
        await storage.write(PLAYERS, pid, sanitisePlayer(obj));
        poolIds.add(pid);
      }
    }

    const next: Record<string, unknown> = { ...raw, playerIds: ids };
    delete next['players'];
    await storage.write(SHEETS, sheetId, next);
  }

  await storage.write(FLAG_COLLECTION, FLAG_ID, {
    id: FLAG_ID,
    completedAt: new Date().toISOString(),
  });
}

function sanitisePlayer(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { id: raw['id'] };
  if (typeof raw['playerName'] === 'string') out['playerName'] = raw['playerName'];
  else if (typeof raw['nickname'] === 'string') out['playerName'] = raw['nickname'];
  else out['playerName'] = '';
  if (typeof raw['firstName'] === 'string') out['firstName'] = raw['firstName'];
  if (typeof raw['lastName'] === 'string') out['lastName'] = raw['lastName'];
  return out;
}
