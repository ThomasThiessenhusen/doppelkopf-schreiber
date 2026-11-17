import { readFileSync } from 'fs';
import { join } from 'path';

import { parseExportFile } from '@/application/import/importParser';
import { effectiveStackingMode } from '@/domain/scoring/bockResolver';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { totalsFor } from '@/domain/scoring/scoreCalculator';

/**
 * Haelt die Beispieldatei aus docs/handschrift-import.md ehrlich: Sie muss
 * vom echten Import-Parser akzeptiert werden und die in der Anleitung
 * genannten Endstaende ergeben.
 */
describe('Beispiel aus docs/handschrift-import.md', () => {
  const raw = readFileSync(join(__dirname, '../../docs/handschrift-import-beispiel.json'), 'utf8');

  test('wird vom Import-Parser akzeptiert', () => {
    const parsed = parseExportFile(raw);
    expect(parsed.envelope.kind).toBe('sheet');
    expect(parsed.envelope.payload.sheets).toHaveLength(1);
  });

  test('ergibt die in der Anleitung genannten Endstaende', () => {
    const { payload } = parseExportFile(raw).envelope;
    const sheet = payload.sheets[0]!;
    const totals = totalsFor(sheet, effectiveStackingMode(sheet, BockStackingMode.sequential));
    const byName: Record<string, number> = {};
    for (const p of payload.players) byName[p.playerName] = totals.totalsByPlayerId.get(p.id) ?? 0;
    expect(byName).toEqual({ Anna: 9, Ben: 13, Carla: -7, Dirk: -15 });
  });
});
