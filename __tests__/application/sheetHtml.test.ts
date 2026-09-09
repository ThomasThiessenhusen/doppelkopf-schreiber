import { buildSheetHtml, type SheetHtmlInput } from '@/application/export/sheetHtml';
import { WinnerSide, type Game } from '@/domain/models/game';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockLevel } from '@/domain/scoring/bockLevel';
import type { GameScore } from '@/domain/scoring/scoreCalculator';

const AT = new Date('2026-09-09T10:00:00.000Z');

/**
 * Fake-Uebersetzung fuer Tests: liefert den Schluessel unveraendert zurueck.
 * `buildSheetHtml` ist dadurch unabhaengig vom globalen i18n-Zustand testbar —
 * die Assertions pruefen bewusst nur HTML-Struktur, keine uebersetzten Texte.
 */
function fakeT(key: string): string {
  return key;
}

function player(id: string, name: string): Player {
  return { id, playerName: name, firstName: null, lastName: null };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    playedAt: AT,
    rePlayerIds: ['p1', 'p2'],
    contraPlayerIds: ['p3', 'p4'],
    sittingOutPlayerId: null,
    winner: WinnerSide.re,
    flagCodes: [],
    note: null,
    isSolo: false,
    triggersManualBock: false,
    ...overrides,
  };
}

function sheet(games: readonly Game[]): GameSheet {
  return {
    id: 's1',
    title: 'Mein erster',
    createdAt: AT,
    updatedAt: AT,
    playerIds: ['p1', 'p2', 'p3', 'p4'],
    rounds: [{ index: 0, games }],
    dirty: false,
    stackingModeOverride: null,
    groupId: null,
  };
}

function score(rePerPlayer: number, contraPerPlayer: number): GameScore {
  return { rePerPlayer, contraPerPlayer };
}

/**
 * Vier Spieler, ein gewonnenes Re-Spiel: Re +1, Kontra -1.
 * Einzelne Felder lassen sich pro Testfall ueberschreiben.
 */
function input(overrides: Partial<SheetHtmlInput> = {}): SheetHtmlInput {
  const players = [
    player('p1', 'Jan'),
    player('p2', 'Andy'),
    player('p3', 'Mirko'),
    player('p4', 'Thomas'),
  ];
  return {
    sheet: sheet([game()]),
    players,
    totalsByPlayerId: new Map([
      ['p1', 6],
      ['p2', -10],
      ['p3', -6],
      ['p4', 10],
    ]),
    gameRows: [
      {
        gameId: 'g1',
        pointsByPlayerId: new Map([
          ['p1', 1],
          ['p2', 1],
          ['p3', -1],
          ['p4', -1],
        ]),
        sittingOutPlayerId: null,
      },
    ],
    scoresByGame: new Map([['g1', score(1, -1)]]),
    bockLevelByGame: new Map([['g1', BockLevel.none]]),
    t: fakeT,
    ...overrides,
  };
}

describe('buildSheetHtml', () => {
  it('setzt eine Spaltenueberschrift pro Spieler', () => {
    const html = buildSheetHtml(input());

    expect(html).toContain('<th>Jan</th>');
    expect(html).toContain('<th>Andy</th>');
    expect(html).toContain('<th>Mirko</th>');
    expect(html).toContain('<th>Thomas</th>');
  });

  it('markiert die Zelle des aussetzenden Spielers statt Punkte zu zeigen', () => {
    const html = buildSheetHtml(
      input({
        gameRows: [
          {
            gameId: 'g1',
            pointsByPlayerId: new Map([
              ['p1', 1],
              ['p2', 1],
              ['p3', -1],
              ['p4', 0],
            ]),
            sittingOutPlayerId: 'p4',
          },
        ],
      }),
    );

    expect(html).toContain('<td class="muted">—</td>');
  });

  it('vergibt unterschiedliche Klassen fuer positive und negative Punkte', () => {
    const html = buildSheetHtml(input());

    expect(html).toContain('<td class="pos">+1</td>');
    expect(html).toContain('<td class="neg">-1</td>');
  });

  it('schreibt eine Summenzeile mit den Gesamtpunkten', () => {
    const html = buildSheetHtml(input());

    expect(html).toContain('<tr class="totals">');
    expect(html).toContain('<td class="bold pos">+6</td>');
    expect(html).toContain('<td class="bold neg">-10</td>');
  });

  it('hebt Spiele in einer Bockrunde hervor', () => {
    const html = buildSheetHtml(
      input({ bockLevelByGame: new Map([['g1', BockLevel.single]]) }),
    );

    expect(html).toContain('class="game bock"');
  });

  it('behandelt ein Solospiel als eigene Aufstellung', () => {
    const html = buildSheetHtml(
      input({
        sheet: sheet([
          game({
            isSolo: true,
            rePlayerIds: ['p1'],
            contraPlayerIds: ['p2', 'p3', 'p4'],
          }),
        ]),
        scoresByGame: new Map([['g1', score(3, -1)]]),
      }),
    );

    // Der Solist steht allein auf der Re-Seite (Label-Schluessel wechselt zu
    // "sheet.soloLabel" statt "sheet.reLabel", nur Jan als Name), und der
    // Gegenwert der Kontra-Partei wird als Zusatz ausgewiesen. Die Fake-
    // Uebersetzung liefert den Schluessel unveraendert zurueck, daher wird
    // hier gegen den Schluessel statt den echten Text geprueft.
    expect(html).toContain('<span class="re-label">sheet.soloLabel:</span> Jan</div>');
    expect(html).toContain('class="muted">(');
  });

  it('maskiert Sonderzeichen in Spielernamen', () => {
    const html = buildSheetHtml(
      input({
        players: [
          player('p1', 'Jan & <b>Andy</b>'),
          player('p2', 'Andy'),
          player('p3', 'Mirko'),
          player('p4', 'Thomas'),
        ],
      }),
    );

    expect(html).toContain('Jan &amp; &lt;b&gt;Andy&lt;/b&gt;');
    expect(html).not.toContain('<b>Andy</b>');
  });
});
