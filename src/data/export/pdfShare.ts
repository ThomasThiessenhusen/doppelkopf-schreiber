import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { repositories } from '@/application/stores/repositories';
import { appSettingsFallback } from '@/domain/models/appSettings';
import { allGames } from '@/domain/models/gameSheet';
import { createPlayerLookup, resolveSheetPlayers } from '@/domain/models/playerLookup';
import { playerDisplayName } from '@/domain/models/player';
import { WinnerSide } from '@/domain/models/game';
import { BockLevel } from '@/domain/scoring/bockLevel';
import { effectiveStackingMode, resolveBock } from '@/domain/scoring/bockResolver';
import { scoreFor, totalsFor } from '@/domain/scoring/scoreCalculator';
import { flagByCode } from '@/domain/scoring/scoringRules';
import { i18n } from '@/presentation/i18n';

function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

function formatPoints(p: number): string {
  return p > 0 ? `+${p}` : `${p}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function suggestPdfFilename(title: string | null, dateIso: string): string {
  const raw = title ?? 'bogen';
  const UMLAUT_MAP: Record<string, string> = {
    ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'ae', Ö: 'oe', Ü: 'ue',
  };
  const slug = [...raw.trim()]
    .map((c) => UMLAUT_MAP[c] ?? c)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `bockzettel-${slug === '' ? 'bogen' : slug}-${dateIso}.pdf`;
}

export async function sharePdf(sheetId: string): Promise<void> {
  const sheet = await repositories.gameSheet().load(sheetId);
  if (sheet === null) throw new Error(`Spielbogen nicht gefunden: ${sheetId}`);

  const pool = await repositories.player().loadAll();
  const settingsRaw = await repositories.settings().load();
  const settings = settingsRaw ?? appSettingsFallback;

  const lookup = createPlayerLookup(pool);
  const players = resolveSheetPlayers(sheet, lookup);
  const mode = effectiveStackingMode(sheet, settings.defaultStackingMode);
  const totals = totalsFor(sheet, mode);
  const bockLevelByGame = resolveBock(sheet, mode);

  // Pre-compute per-game score rows
  const gameRows: Array<{
    gameId: string;
    pointsByPlayerId: Map<string, number>;
    sittingOutPlayerId: string | null;
  }> = [];
  const scoresByGame = new Map<string, ReturnType<typeof scoreFor>>();
  for (const game of allGames(sheet)) {
    const level = bockLevelByGame.get(game.id) ?? BockLevel.none;
    const score = scoreFor(game, level);
    scoresByGame.set(game.id, score);
    const points = new Map<string, number>();
    for (const p of players) {
      points.set(
        p.id,
        game.rePlayerIds.includes(p.id)
          ? score.rePerPlayer
          : game.contraPlayerIds.includes(p.id)
            ? score.contraPerPlayer
            : 0,
      );
    }
    gameRows.push({ gameId: game.id, pointsByPlayerId: points, sittingOutPlayerId: game.sittingOutPlayerId });
  }

  const html = buildHtml(sheet, players, totals.totalsByPlayerId, gameRows, scoresByGame, bockLevelByGame);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // Move to named file in cache so the share sheet shows a readable name
  const dateIso = new Date().toISOString().slice(0, 10);
  const filename = suggestPdfFilename(sheet.title, dateIso);
  const cacheDir = `${FileSystem.cacheDirectory ?? ''}exports/`;
  const info = await FileSystem.getInfoAsync(cacheDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
  const destUri = `${cacheDir}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error('Sharing ist auf diesem Gerät nicht verfügbar.');
  await Sharing.shareAsync(destUri, { mimeType: 'application/pdf', dialogTitle: 'PDF teilen' });
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildHtml(
  sheet: Parameters<typeof allGames>[0],
  players: ReturnType<typeof resolveSheetPlayers>,
  totalsByPlayerId: ReadonlyMap<string, number>,
  gameRows: Array<{ gameId: string; pointsByPlayerId: Map<string, number>; sittingOutPlayerId: string | null }>,
  scoresByGame: Map<string, ReturnType<typeof scoreFor>>,
  bockLevelByGame: ReadonlyMap<string, BockLevel>,
): string {
  const title = sheet.title ?? t('sheet.titleFallback');
  const dateStr = formatDate(sheet.createdAt);
  const playerNames = players.map((p) => esc(playerDisplayName(p)));

  // ---- Scoreboard table ----
  const headerCells = playerNames.map((n) => `<th>${n}</th>`).join('');
  const bodyRows = gameRows
    .map((row, idx) => {
      const cells = players
        .map((p) => {
          const isSO = p.id === row.sittingOutPlayerId;
          const pts = row.pointsByPlayerId.get(p.id) ?? 0;
          if (isSO) return `<td class="muted">—</td>`;
          const cls = pts > 0 ? 'pos' : pts < 0 ? 'neg' : '';
          return `<td class="${cls}">${esc(formatPoints(pts))}</td>`;
        })
        .join('');
      return `<tr><td class="idx">${idx + 1}</td>${cells}</tr>`;
    })
    .join('');

  const totalCells = players
    .map((p) => {
      const tot = totalsByPlayerId.get(p.id) ?? 0;
      const cls = tot > 0 ? 'pos' : tot < 0 ? 'neg' : '';
      return `<td class="bold ${cls}">${esc(formatPoints(tot))}</td>`;
    })
    .join('');

  const scoreboardHtml = `
    <h2>${esc(t('sheet.scoreboardTitle'))}</h2>
    <table>
      <thead>
        <tr><th class="idx">#</th>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
        <tr class="totals"><td class="idx bold">Σ</td>${totalCells}</tr>
      </tbody>
    </table>`;

  // ---- Round sections ----
  function playerById(id: string) {
    return players.find((p) => p.id === id);
  }
  function names(ids: ReadonlyArray<string>): string {
    return ids
      .map((id) => playerById(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => esc(playerDisplayName(p)))
      .join(' &amp; ');
  }
  function flagsLabel(codes: ReadonlyArray<string>): string {
    return codes
      .map((c) => flagByCode(c))
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => esc(t(f.labelKey)))
      .join(' · ');
  }

  const roundsHtml = sheet.rounds
    .map((round) => {
      const gamesHtml = round.games
        .map((game, gi) => {
          const score = scoresByGame.get(game.id) ?? { rePerPlayer: 0, contraPerPlayer: 0 };
          const level = bockLevelByGame.get(game.id) ?? BockLevel.none;
          const reLabel = game.isSolo ? t('sheet.soloLabel') : t('sheet.reLabel');
          const winnerText =
            game.winner === WinnerSide.re
              ? game.isSolo
                ? t('sheet.soloWinner')
                : t('sheet.reLabel')
              : t('sheet.kontraWinner');
          const flags = flagsLabel(game.flagCodes);
          const sittingOut = game.sittingOutPlayerId !== null ? playerById(game.sittingOutPlayerId) : null;

          const meta: string[] = [
            esc(t('sheet.winnerWins', { side: winnerText })),
            ...(flags !== '' ? [flags] : []),
            ...(level === BockLevel.single ? [esc(t('sheet.bockSingleSuffix'))] : []),
            ...(level === BockLevel.double ? [esc(t('sheet.bockDoubleSuffix'))] : []),
          ];

          const scoreColor = score.rePerPlayer >= 0 ? '#1565c0' : '#b71c1c';
          const soloNote =
            game.isSolo
              ? ` <span class="muted">(${esc(t('sheet.contraPerPlayer', { points: formatPoints(score.contraPerPlayer) }))})</span>`
              : '';

          return `
          <div class="game${level !== BockLevel.none ? ' bock' : ''}">
            <div class="game-row">
              <div class="game-num">${gi + 1}.</div>
              <div class="game-detail">
                <div><span class="re-label">${esc(reLabel)}:</span> ${names(game.rePlayerIds)}</div>
                <div><span class="contra-label">${esc(t('sheet.kontraLabel'))}:</span> ${names(game.contraPlayerIds)}</div>
                ${sittingOut !== null && sittingOut !== undefined ? `<div class="muted">${esc(t('sheet.sittingOut', { name: playerDisplayName(sittingOut) }))}</div>` : ''}
                <div class="meta">${meta.join(' · ')}</div>
              </div>
              <div class="score" style="color:${scoreColor}">${esc(formatPoints(score.rePerPlayer))}${soloNote}</div>
            </div>
          </div>`;
        })
        .join('');

      return `
      <div class="round">
        <h3>${esc(t('sheet.roundTitle', { n: round.index + 1 }))}</h3>
        ${gamesHtml}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    margin: 0;
    padding: 20px 24px;
    line-height: 1.4;
  }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 20px 0 6px; border-bottom: 1px solid #bbb; padding-bottom: 2px; }
  h3 { font-size: 13px; margin: 14px 0 4px; color: #444; }
  .subtitle { color: #666; font-size: 12px; margin: 0 0 16px; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
  th { background: #f0f0f0; font-weight: 600; }
  .idx { width: 28px; color: #777; font-size: 11px; }
  .pos { color: #1565c0; }
  .neg { color: #b71c1c; }
  .muted { color: #888; }
  .bold { font-weight: bold; }
  .totals td { border-top: 2px solid #555; background: #fafafa; }

  .round { margin-bottom: 12px; }
  .game { border: 1px solid #e0e0e0; border-radius: 4px; margin: 4px 0; padding: 6px 8px; }
  .game.bock { background: #fff8e1; border-color: #ffe082; }
  .game-row { display: flex; align-items: flex-start; gap: 6px; }
  .game-num { width: 20px; font-size: 12px; color: #777; padding-top: 1px; flex-shrink: 0; }
  .game-detail { flex: 1; }
  .re-label { color: #1565c0; font-weight: 600; font-size: 11px; }
  .contra-label { color: #b71c1c; font-weight: 600; font-size: 11px; }
  .meta { color: #555; font-size: 11px; margin-top: 2px; }
  .score { font-weight: 700; font-size: 15px; min-width: 36px; text-align: right; flex-shrink: 0; }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="subtitle">${dateStr}</p>
  ${scoreboardHtml}
  ${sheet.rounds.length > 0 ? roundsHtml : ''}
</body>
</html>`;
}
