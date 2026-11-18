import { buildSheetHtml } from '@/application/export/sheetHtml';
import { createPointsGame } from '@/domain/models/game';
import { createGameSheet, sheetWithGame } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';
import { gameRowsFor } from '@/domain/scoring/gamePoints';
import { totalsFor } from '@/domain/scoring/scoreCalculator';

function player(id: string, name: string): Player {
  return { id, playerName: name, firstName: null, lastName: null };
}

describe('buildSheetHtml mit Punkte-Spielen', () => {
  const players = [player('a', 'Anna'), player('b', 'Ben'), player('c', 'Carla'), player('d', 'Dirk')];
  let sheet = createGameSheet({ players, title: 'Papierabend' });
  sheet = sheetWithGame(
    sheet,
    createPointsGame({ pointsByPlayerId: { a: 3, b: 3, c: -3, d: -3 } }),
  );
  sheet = sheetWithGame(
    sheet,
    createPointsGame({ pointsByPlayerId: { a: -9, b: 3, c: 3, d: 3 } }),
  );

  function render(): string {
    return buildSheetHtml({
      sheet,
      players,
      totalsByPlayerId: totalsFor(sheet, BockStackingMode.sequential).totalsByPlayerId,
      gameRows: gameRowsFor(sheet, BockStackingMode.sequential),
      scoresByGame: new Map(),
      bockLevelByGame: new Map(),
      t: (key) => key,
    });
  }

  test('zeigt Punkte je Spieler und die Summenzeile', () => {
    const html = render();
    expect(html).toContain('<td class="pos">+3</td>');
    expect(html).toContain('<td class="neg">-9</td>');
    expect(html).toContain('<td class="bold neg">-6</td>');
    expect(html).toContain('<td class="bold pos">+6</td>');
  });

  test('Runden-Abschnitt nennt Punkte statt Teams und Flags', () => {
    const html = render();
    expect(html).toContain('sheet.pointsGameLabel');
    expect(html).toContain('Anna +3');
    expect(html).toContain('Anna -9');
    expect(html).not.toContain('sheet.reLabel');
    expect(html).not.toContain('sheet.kontraLabel');
  });
});
