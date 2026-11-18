import { parseScanText, ScanParseError } from '@/application/import/scanParser';

function scan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    app: 'doppelkopf_schreiber',
    kind: 'scan',
    formatVersion: 1,
    title: 'Dienstagsrunde',
    playedAt: '2026-11-10',
    players: ['Thomas', 'Anna', 'Ben', 'Clara'],
    games: [{ points: [3, 3, -3, -3] }, { points: [-9, 3, 3, 3] }, { points: [3, null, -3, -3] }],
    totals: [-3, 9, -3, -3],
    uncertain: [{ game: 2, player: 1 }],
    ...overrides,
  };
}

describe('parseScanText gueltige Eingaben', () => {
  test('liest das Beispiel vollstaendig', () => {
    const s = parseScanText(JSON.stringify(scan()));
    expect(s.title).toBe('Dienstagsrunde');
    expect(s.players).toEqual(['Thomas', 'Anna', 'Ben', 'Clara']);
    expect(s.games).toHaveLength(3);
    expect(s.games[2]).toEqual([3, null, -3, -3]);
    expect(s.totals).toEqual([-3, 9, -3, -3]);
    expect(s.uncertain).toEqual([{ game: 2, player: 1 }]);
    expect(s.playedAt!.getFullYear()).toBe(2026);
    expect(s.playedAt!.getMonth()).toBe(10);
    expect(s.playedAt!.getDate()).toBe(10);
  });

  test('ignoriert Codeblock und Fliesstext drumherum', () => {
    const text = `Hier ist die Abschrift:\n\`\`\`json\n${JSON.stringify(scan())}\n\`\`\`\nViel Spass!`;
    expect(parseScanText(text).players).toHaveLength(4);
  });

  test('Klammern in Strings stoeren nicht', () => {
    const s = parseScanText(JSON.stringify(scan({ title: 'Runde {1} "x"' })));
    expect(s.title).toBe('Runde {1} "x"');
  });

  test('nur das erste JSON-Objekt zaehlt', () => {
    const text = `${JSON.stringify(scan())}\n${JSON.stringify(scan({ title: 'zweites' }))}`;
    expect(parseScanText(text).title).toBe('Dienstagsrunde');
  });

  test('leere Spieleliste ist gueltig', () => {
    expect(parseScanText(JSON.stringify(scan({ games: [], totals: null }))).games).toEqual([]);
  });

  test('optionale Felder duerfen fehlen', () => {
    const s = parseScanText(
      JSON.stringify({ kind: 'scan', players: ['A', 'B', 'C', 'D'], games: [] }),
    );
    expect(s.title).toBeNull();
    expect(s.playedAt).toBeNull();
    expect(s.totals).toBeNull();
    expect(s.uncertain).toEqual([]);
  });

  test('unsichere Zellen ausserhalb des Rasters werden verworfen', () => {
    const s = parseScanText(
      JSON.stringify(scan({ uncertain: [{ game: 3, player: 0 }, { game: 0, player: 4 }] })),
    );
    expect(s.uncertain).toEqual([]);
  });

  test('Spielernamen werden getrimmt', () => {
    const s = parseScanText(JSON.stringify(scan({ players: [' Thomas ', 'Anna', 'Ben', 'Clara'] })));
    expect(s.players[0]).toBe('Thomas');
  });
});

describe('parseScanText Fehler', () => {
  test('kein JSON im Text', () => {
    expect(() => parseScanText('Leider kein Ergebnis')).toThrow(ScanParseError);
  });

  test('falsches kind', () => {
    expect(() => parseScanText(JSON.stringify(scan({ kind: 'sheet' })))).toThrow(/kind/);
  });

  test('falsche formatVersion', () => {
    expect(() => parseScanText(JSON.stringify(scan({ formatVersion: 2 })))).toThrow(/formatVersion/);
  });

  test('3 Spieler', () => {
    expect(() =>
      parseScanText(JSON.stringify(scan({ players: ['A', 'B', 'C'], games: [], totals: null }))),
    ).toThrow(/Spieler/);
  });

  test('Zeile mit falscher Laenge nennt die Spielnummer', () => {
    const bad = scan({ games: [{ points: [1, -1, 0, 0] }, { points: [1, -1, 0] }] });
    expect(() => parseScanText(JSON.stringify(bad))).toThrow(/Spiel 2/);
  });

  test('Dezimalzahl und String als Punkte', () => {
    expect(() =>
      parseScanText(JSON.stringify(scan({ games: [{ points: [1.5, -1.5, 0, 0] }] }))),
    ).toThrow(/Spiel 1/);
    expect(() =>
      parseScanText(JSON.stringify(scan({ games: [{ points: ['3', -3, 0, 0] }] }))),
    ).toThrow(/Spiel 1/);
  });

  test('Komma am Ende wird als fehlerhaftes JSON gemeldet, nicht als falsches kind', () => {
    const broken = JSON.stringify(scan()).replace(/\}$/, ',}');
    expect(() => parseScanText(broken)).toThrow(/fehlerhaft/);
  });

  test('abgeschnittene Antwort wird als unvollstaendig gemeldet', () => {
    const cut = JSON.stringify(scan()).slice(0, 120);
    expect(() => parseScanText(cut)).toThrow(/unvollst/);
  });

  test('ein Beispiel-Objekt vor der echten Abschrift wird uebersprungen', () => {
    const text = `Format: {"beispiel": true}
${JSON.stringify(scan())}`;
    expect(parseScanText(text).title).toBe('Dienstagsrunde');
  });

  test('totals mit falscher Laenge', () => {
    expect(() => parseScanText(JSON.stringify(scan({ totals: [1, 2] })))).toThrow(/totals/);
  });
});
