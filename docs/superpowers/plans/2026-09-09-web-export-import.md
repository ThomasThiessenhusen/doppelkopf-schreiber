# Web Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export und Import funktionieren im Browser genauso wie auf Android und iOS — JSON-Backup raus, JSON-Backup rein, PDF-Export.

**Architecture:** Alle plattformspezifischen Zugriffe kommen hinter Datei-Suffix-Paare (`foo.ts` / `foo.web.ts`), die Metro pro Target auflöst — dasselbe Muster, das `createStorage` und `requestPersistence` auf diesem Branch schon benutzen. Der bisher in `pdfShare.ts` eingeschlossene HTML-Bau wandert in die plattformneutrale Anwendungsschicht, damit beide PDF-Adapter ihn teilen und er endlich testbar ist. Web-Adapter bekommen ihre DOM-Abhängigkeiten als Parameter mit Default, statt Globals zu greifen.

**Tech Stack:** TypeScript (strict), React Native 0.83.6 / react-native-web, Expo SDK 55, Jest (`testEnvironment: 'node'`), i18next.

**Spec:** [docs/superpowers/specs/2026-09-09-web-target-design.md](../specs/2026-09-09-web-target-design.md)

**Use-Case-Canvas:** `a1t2-canvas-a-use-case.md` (Repo-Root, untracked) — Erfolgskriterium: „Das Speichern, Laden und ein Export/Import ist möglich und die Erfassung lässt sich fortsetzen", auf Android, iOS **und** HTML. Ausdrücklich nicht im Scope: fachliche Erweiterungen und GUI-Änderungen, die nicht auf Speichern/Laden/Import/Export einzahlen.

## Global Constraints

- **Package-Manager npm.** `npm install` lokal, `npm ci` in der anderen Umgebung. Kein pnpm, kein yarn. `package.json` **und** `package-lock.json` zusammen committen.
- **Keine neuen Runtime-Dependencies.** Das Spec sagt das explizit; dieser Plan hält es ein und kommt zusätzlich ohne neue devDependency aus (siehe Abweichung unten).
- **Beide Build-Umgebungen müssen baubar bleiben** (Windows/Android, macOS/iOS). Jede Änderung an plattformnahen Modulen im Commit-Text markieren.
- **Native-Ordner `/android` und `/ios` sind gitignored** und werden aus `app.json` regeneriert — niemals hineinpatchen.
- **Tests laufen in `testEnvironment: 'node'`**, reine Logik, handgeschriebene Mocks unter `__mocks__/`. Keine Component-Rendering-Tests.
- **Pfad-Alias `@/` → `src/`** (siehe `jest.config.js` und `tsconfig.json`).
- **Vor jedem Commit:** `npm run typecheck`, `npm run lint`, `npm test`.
- **Sprache im Code:** Kommentare und Doc-Blöcke auf Deutsch ohne Umlaute in bestehenden Dateien fortführen (`ue`, `oe`, `ae`) — dem Stil der Nachbardateien folgen.

### Dokumentierte Abweichung vom Spec

Das Spec sieht `jest-environment-jsdom` als neue devDependency vor und testet die Web-Adapter per Docblock in jsdom. Dieser Plan tut das **nicht**. Stattdessen bekommen die Web-Adapter ihre DOM-Abhängigkeiten (`Document`, `fetch`, `Navigator`) als Parameter mit Default-Wert — exakt das Muster, das `src/data/local/requestPersistence.web.ts:24` auf diesem Branch bereits etabliert und im Doc-Block begründet hat. Gründe:

1. Keine neue devDependency, also kein Lockfile-Wechsel, den die macOS-Umgebung mit `npm ci` nachziehen muss.
2. Die Tests bleiben im schnellen `node`-Environment, konsistent mit den übrigen 35 Suites.
3. Die injizierten Abhängigkeiten sind ohnehin die schärfere Testnaht: sie zwingen dazu, die Adapter dünn zu halten.

Falls sich das bei `pdfShare.web` als zu eng erweist (Task 5), ist der Rückfall auf jsdom dokumentiert und billig — dann aber als eigener Commit mit Lockfile.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `src/data/local/readTextFile.ts` | **Neu.** Native: Textdatei per URI lesen (`FileSystem.readAsStringAsync`). |
| `src/data/local/readTextFile.web.ts` | **Neu.** Web: `fetch(uri)` → `text()`, funktioniert für `blob:`-URLs. |
| `src/data/import/pickImportFile.ts` | **Neu.** Native: `DocumentPicker.getDocumentAsync`. |
| `src/data/import/pickImportFile.web.ts` | **Neu.** Web: verstecktes `<input type="file">` + `URL.createObjectURL`. |
| `src/application/export/sheetHtml.ts` | **Neu.** Plattformneutral: Daten sammeln und das Bogen-HTML bauen. Nimmt ~170 Zeilen aus `pdfShare.ts` auf. |
| `src/data/export/pdfShare.ts` | **Ändern.** Schrumpft auf den nativen Adapter: HTML → PDF-Datei → Share-Sheet. |
| `src/data/export/pdfShare.web.ts` | **Neu.** Web: HTML in ein verstecktes iframe, `print()`. |
| `src/data/export/fileShare.web.ts` | **Neu.** Web: Blob + `<a download>`; `navigator.share`, wenn vorhanden. |
| `src/presentation/screens/ImportReviewScreen.tsx` | **Ändern.** Benutzt `readTextFile` statt `FileSystem`. |
| `src/presentation/screens/SettingsScreen.tsx` | **Ändern.** Benutzt `pickImportFile` statt `DocumentPicker`. |
| `src/presentation/i18n/locales/{de,en}.ts` | **Ändern.** Zwei neue Fehlermeldungs-Keys. |

---

### Task 1: `readTextFile`-Naht

Ohne diese Naht bricht der Import-Review-Screen im Browser: `expo-file-system/legacy` kann eine `blob:`-URL nicht lesen.

**Files:**
- Create: `src/data/local/readTextFile.ts`
- Create: `src/data/local/readTextFile.web.ts`
- Create: `__tests__/data/readTextFileWeb.test.ts`
- Modify: `src/presentation/screens/ImportReviewScreen.tsx:1` und `:67`

**Interfaces:**
- Produces: `readTextFile(uri: string): Promise<string>` — beide Varianten. Die Web-Variante nimmt zusätzlich einen optionalen zweiten Parameter `fetchImpl: typeof fetch`, den nur Tests setzen.
- Consumes: nichts.

- [ ] **Step 1: Write the failing test**

`__tests__/data/readTextFileWeb.test.ts`:

```ts
import { readTextFile } from '@/data/local/readTextFile.web';

function response(body: string, init: { ok: boolean; status: number }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => body,
  } as Response;
}

describe('readTextFile (web)', () => {
  it('liefert den Text der geholten Datei', async () => {
    const fetchImpl = jest.fn(async () => response('{"a":1}', { ok: true, status: 200 }));

    await expect(readTextFile('blob:http://x/1', fetchImpl as unknown as typeof fetch)).resolves.toBe(
      '{"a":1}',
    );
    expect(fetchImpl).toHaveBeenCalledWith('blob:http://x/1');
  });

  it('wirft mit dem Status, wenn die Antwort nicht ok ist', async () => {
    const fetchImpl = jest.fn(async () => response('', { ok: false, status: 404 }));

    await expect(
      readTextFile('blob:http://x/weg', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('404');
  });

  it('reicht einen Netzwerkfehler als Wurf durch', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('NetworkError');
    });

    await expect(
      readTextFile('blob:http://x/1', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('NetworkError');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/data/readTextFileWeb.test.ts`
Expected: FAIL — `Cannot find module '@/data/local/readTextFile.web'`.

- [ ] **Step 3: Write the web implementation**

`src/data/local/readTextFile.web.ts`:

```ts
/**
 * Web-Variante: liest eine Textdatei ueber `fetch`. Das deckt beide Faelle
 * ab, die im Browser vorkommen — eine `blob:`-URL aus dem Datei-Dialog und
 * eine gewoehnliche URL aus dem gehosteten Build.
 *
 * `fetch` kommt als Parameter herein, damit der Test kein Global
 * ueberschreiben muss; dieselbe Begruendung wie bei
 * `requestPersistence.web.ts`.
 */
export async function readTextFile(
  uri: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string> {
  const res = await fetchImpl(uri);
  if (!res.ok) {
    throw new Error(`Datei konnte nicht gelesen werden (HTTP ${res.status}).`);
  }
  return res.text();
}
```

- [ ] **Step 4: Write the native implementation**

`src/data/local/readTextFile.ts`:

```ts
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Native Variante: liest eine Textdatei ueber den vom DocumentPicker
 * gelieferten `file://`- bzw. `content://`-URI.
 *
 * Das Gegenstueck ist `readTextFile.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export function readTextFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/data/readTextFileWeb.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 6: Rewire `ImportReviewScreen`**

In `src/presentation/screens/ImportReviewScreen.tsx` die erste Zeile

```ts
import * as FileSystem from 'expo-file-system/legacy';
```

ersetzen durch

```ts
import { readTextFile } from '@/data/local/readTextFile';
```

(Der Import gehört zur `@/`-Gruppe, also unter `import type { RootStackParamList }` einsortieren, dem Reihenfolge-Stil der Datei folgend.)

Und in Zeile 67

```ts
        const text = await FileSystem.readAsStringAsync(fileUri);
```

ersetzen durch

```ts
        const text = await readTextFile(fileUri);
```

- [ ] **Step 7: Verify the whole suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck sauber, Lint 0 Fehler, alle Suites grün (36 Suites nach diesem Task).

- [ ] **Step 8: Commit**

```bash
git add src/data/local/readTextFile.ts src/data/local/readTextFile.web.ts __tests__/data/readTextFileWeb.test.ts src/presentation/screens/ImportReviewScreen.tsx
git commit -m "feat(import): Textdatei-Lesen hinter eine Plattform-Naht legen

Betrifft beide Build-Umgebungen: neue .web-Variante, Native-Verhalten
unveraendert.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `pickImportFile`-Naht

**Files:**
- Create: `src/data/import/pickImportFile.ts`
- Create: `src/data/import/pickImportFile.web.ts`
- Create: `__tests__/data/pickImportFileWeb.test.ts`
- Modify: `src/presentation/screens/SettingsScreen.tsx:5` und `:129-145`

**Interfaces:**
- Consumes: nichts aus Task 1.
- Produces: `type PickedFile = { status: 'picked'; uri: string } | { status: 'cancelled' }` und `pickImportFile(): Promise<PickedFile>`. Der `uri` ist auf Native ein `file://`/`content://`-Pfad, im Web eine `blob:`-URL — beides frisst `readTextFile` aus Task 1.

- [ ] **Step 1: Write the failing test**

`__tests__/data/pickImportFileWeb.test.ts`:

```ts
import { pickImportFile } from '@/data/import/pickImportFile.web';

interface FakeInput {
  type: string;
  accept: string;
  files: File[] | null;
  style: { display: string };
  addEventListener: (name: string, fn: () => void) => void;
  click: () => void;
  remove: () => void;
  fire: (name: string) => void;
}

function fakeDocument(): { doc: Document; input: FakeInput; appended: FakeInput[] } {
  const handlers = new Map<string, () => void>();
  const appended: FakeInput[] = [];
  const input: FakeInput = {
    type: '',
    accept: '',
    files: null,
    style: { display: '' },
    addEventListener: (name, fn) => {
      handlers.set(name, fn);
    },
    click: () => {},
    remove: () => {},
    fire: (name) => handlers.get(name)?.(),
  };
  const doc = {
    createElement: () => input,
    body: { appendChild: (el: FakeInput) => appended.push(el) },
  } as unknown as Document;
  return { doc, input, appended };
}

describe('pickImportFile (web)', () => {
  const origCreate = URL.createObjectURL;

  afterEach(() => {
    URL.createObjectURL = origCreate;
  });

  it('liefert eine blob-URL, wenn eine Datei gewaehlt wurde', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:http://x/42') as typeof URL.createObjectURL;
    const { doc, input } = fakeDocument();

    const pending = pickImportFile(doc);
    input.files = [{ name: 'backup.json' } as File];
    input.fire('change');

    await expect(pending).resolves.toEqual({ status: 'picked', uri: 'blob:http://x/42' });
  });

  it('meldet Abbruch, wenn der Dialog ohne Datei zurueckkommt', async () => {
    const { doc, input } = fakeDocument();

    const pending = pickImportFile(doc);
    input.files = [];
    input.fire('change');

    await expect(pending).resolves.toEqual({ status: 'cancelled' });
  });

  it('meldet Abbruch beim cancel-Event des Dialogs', async () => {
    const { doc, input } = fakeDocument();

    const pending = pickImportFile(doc);
    input.fire('cancel');

    await expect(pending).resolves.toEqual({ status: 'cancelled' });
  });

  it('haengt das Element in das Dokument und klickt es an', async () => {
    const { doc, input, appended } = fakeDocument();
    const click = jest.fn();
    input.click = click;

    const pending = pickImportFile(doc);
    input.fire('cancel');
    await pending;

    expect(appended).toHaveLength(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(input.type).toBe('file');
  });

  it('loest nur einmal auf, auch wenn beide Events feuern', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:http://x/1') as typeof URL.createObjectURL;
    const { doc, input } = fakeDocument();

    const pending = pickImportFile(doc);
    input.files = [{ name: 'a.json' } as File];
    input.fire('change');
    input.fire('cancel');

    await expect(pending).resolves.toEqual({ status: 'picked', uri: 'blob:http://x/1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/data/pickImportFileWeb.test.ts`
Expected: FAIL — `Cannot find module '@/data/import/pickImportFile.web'`.

- [ ] **Step 3: Write the web implementation**

`src/data/import/pickImportFile.web.ts`:

```ts
import type { PickedFile } from '@/data/import/pickImportFile';

export type { PickedFile };

/**
 * Web-Variante: haengt ein verstecktes `<input type="file">` ins Dokument,
 * klickt es an und gibt die Auswahl als `blob:`-URL zurueck. `readTextFile`
 * kann diese URL direkt lesen.
 *
 * Zwei Faelle bedeuten Abbruch: das `cancel`-Event des Dialogs, und ein
 * `change` ohne Datei. Aeltere Browser kennen `cancel` nicht — dort bleibt
 * das Promise offen, bis der Nutzer erneut waehlt. Das ist derselbe
 * Kompromiss, den der native Picker mit einer weggewischten Activity hat.
 *
 * Das `Document` kommt als Parameter herein, damit der Test ohne jsdom
 * auskommt; dieselbe Begruendung wie bei `requestPersistence.web.ts`.
 */
export function pickImportFile(doc: Document = globalThis.document): Promise<PickedFile> {
  return new Promise<PickedFile>((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    let erledigt = false;
    function fertig(ergebnis: PickedFile): void {
      if (erledigt) return;
      erledigt = true;
      input.remove();
      resolve(ergebnis);
    }

    input.addEventListener('change', () => {
      const datei = input.files?.[0];
      fertig(
        datei === undefined
          ? { status: 'cancelled' }
          : { status: 'picked', uri: URL.createObjectURL(datei) },
      );
    });
    input.addEventListener('cancel', () => fertig({ status: 'cancelled' }));

    doc.body.appendChild(input);
    input.click();
  });
}
```

- [ ] **Step 4: Write the native implementation**

`src/data/import/pickImportFile.ts`:

```ts
import * as DocumentPicker from 'expo-document-picker';

/**
 * Ergebnis der Dateiauswahl. `cancelled` ist ein normaler Ausgang, kein
 * Fehler — der Aufrufer tut dann schlicht nichts.
 */
export type PickedFile = { status: 'picked'; uri: string } | { status: 'cancelled' };

/**
 * Native Variante: System-Dateidialog ueber `expo-document-picker`.
 *
 * Das Gegenstueck ist `pickImportFile.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export async function pickImportFile(): Promise<PickedFile> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled === true) return { status: 'cancelled' };

  const uri = res.assets?.[0]?.uri;
  if (typeof uri !== 'string') return { status: 'cancelled' };

  return { status: 'picked', uri };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/data/pickImportFileWeb.test.ts`
Expected: PASS, 5 Tests.

> **Mögliche Stolperstelle beim Typecheck:** Ob `'cancel'` in der `HTMLElementEventMap` der benutzten `lib.dom` steht, hängt an der TypeScript-Version. Meckert `tsc`, dann **nicht** den Handler löschen — er ist der einzige saubere Abbruch-Pfad —, sondern ihn als `input.addEventListener('cancel' as keyof HTMLElementEventMap, ...)` schreiben und den Grund als Kommentar dazu.

- [ ] **Step 6: Rewire `SettingsScreen`**

In `src/presentation/screens/SettingsScreen.tsx` Zeile 5 löschen:

```ts
import * as DocumentPicker from 'expo-document-picker';
```

Und in der `@/`-Import-Gruppe ergänzen:

```ts
import { pickImportFile } from '@/data/import/pickImportFile';
```

Den `onPress`-Rumpf des Import-Buttons (Zeilen 129–145) ersetzen durch:

```tsx
          onPress={() => {
            void (async () => {
              const res = await pickImportFile();
              if (res.status === 'cancelled') return;
              navigation.navigate('ImportReview', { fileUri: res.uri });
            })();
          }}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alles grün, 37 Suites.

- [ ] **Step 8: Commit**

```bash
git add src/data/import/ __tests__/data/pickImportFileWeb.test.ts src/presentation/screens/SettingsScreen.tsx
git commit -m "feat(import): Dateiauswahl hinter eine Plattform-Naht legen

Betrifft beide Build-Umgebungen: SettingsScreen benutzt statt
expo-document-picker jetzt pickImportFile mit .web-Gegenstueck.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Bogen-HTML in die Anwendungsschicht heben

Reiner Umzug plus Tests. `buildHtml` in `src/data/export/pdfShare.ts:116-286` ist modul-privat und darum bis heute ungetestet; zusammen mit der Datenbeschaffung aus `sharePdf` (Zeilen 54–92) ist es der einzige Teil, den beide PDF-Adapter brauchen.

**Files:**
- Create: `src/application/export/sheetHtml.ts`
- Create: `__tests__/application/sheetHtml.test.ts`
- Modify: `src/data/export/pdfShare.ts` (schrumpft auf den nativen Adapter)

**Interfaces:**
- Consumes: nichts aus Task 1/2.
- Produces:
  - `buildSheetHtml(input: SheetHtmlInput): string` — pure, keine I/O.
  - `renderSheetHtml(sheetId: string): Promise<{ html: string; filename: string }>` — sammelt über `repositories` und ruft `buildSheetHtml`.
  - `interface SheetHtmlInput` mit den Feldern `sheet`, `players`, `totalsByPlayerId`, `gameRows`, `scoresByGame`, `bockLevelByGame` — dieselben sechs Werte, die `buildHtml` heute als Positionsparameter nimmt.
  - Task 4 und 5 hängen an `renderSheetHtml`.

- [ ] **Step 1: Move the code**

`src/application/export/sheetHtml.ts` anlegen. Hineinnehmen, unverändert:

- die Hilfsfunktionen `t`, `formatPoints`, `formatDate`, `esc` aus `pdfShare.ts:17-35`,
- `suggestPdfFilename` aus `pdfShare.ts:37-51`,
- den kompletten Körper von `buildHtml`, `pdfShare.ts:116-286`,
- die Datenbeschaffung aus `sharePdf`, `pdfShare.ts:54-92` (alles bis einschließlich der `gameRows`-Schleife).

Die Signatur von `buildHtml` wird von sechs Positionsparametern auf ein Objekt umgestellt und exportiert:

```ts
export interface SheetHtmlInput {
  readonly sheet: GameSheet;
  readonly players: ReadonlyArray<Player>;
  readonly totalsByPlayerId: ReadonlyMap<string, number>;
  readonly gameRows: ReadonlyArray<{
    gameId: string;
    pointsByPlayerId: ReadonlyMap<string, number>;
    sittingOutPlayerId: string | null;
  }>;
  readonly scoresByGame: ReadonlyMap<string, GameScore>;
  readonly bockLevelByGame: ReadonlyMap<string, BockLevel>;
}
```

Die Typen sind bewusst konkret statt `ReturnType<typeof ...>`: `resolveSheetPlayers` liefert `ReadonlyArray<Player>` (`playerLookup.ts:26`), `scoreFor` liefert `GameScore` (`scoreCalculator.ts:10`). Beide importieren:

```ts
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import type { GameScore } from '@/domain/scoring/scoreCalculator';

export function buildSheetHtml(input: SheetHtmlInput): string {
  const { sheet, players, totalsByPlayerId, gameRows, scoresByGame, bockLevelByGame } = input;
  // ... unveraenderter Rumpf aus pdfShare.ts:130-286
}

/**
 * Sammelt alles, was der Bogen zum Drucken braucht, und baut das HTML.
 * Plattformneutral — die Adapter darueber entscheiden nur noch, was mit
 * dem fertigen HTML passiert.
 */
export async function renderSheetHtml(
  sheetId: string,
): Promise<{ html: string; filename: string }> {
  // ... unveraenderte Datenbeschaffung aus pdfShare.ts:54-92
  const html = buildSheetHtml({
    sheet, players, totalsByPlayerId: totals.totalsByPlayerId,
    gameRows, scoresByGame, bockLevelByGame,
  });
  const dateIso = new Date().toISOString().slice(0, 10);
  return { html, filename: suggestPdfFilename(sheet.title, dateIso) };
}
```

- [ ] **Step 2: Shrink `pdfShare.ts` to the native adapter**

`src/data/export/pdfShare.ts` enthält danach nur noch:

```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { renderSheetHtml } from '@/application/export/sheetHtml';

/**
 * Native Variante: HTML -> PDF-Datei -> System-Share-Sheet.
 *
 * Das Gegenstueck ist `pdfShare.web.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export async function sharePdf(sheetId: string): Promise<void> {
  const { html, filename } = await renderSheetHtml(sheetId);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

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
```

- [ ] **Step 3: Verify nothing broke before adding tests**

Run: `npm run typecheck && npm test`
Expected: typecheck sauber, alle bisherigen Suites weiter grün. `SheetScreen.tsx:42` importiert `sharePdf` unverändert weiter.

- [ ] **Step 4: Write the tests for the now-reachable code**

`__tests__/application/sheetHtml.test.ts` — sieben Fälle, die das Spec fordert. `buildSheetHtml` ist pur, der Test braucht also keine Repositories. Die Assertions hängen bewusst an der HTML-Struktur (Klassen, Zahlen, Maskierung) und **nicht** an übersetzten Texten, damit sie nicht an der i18n-Initialisierung im Node-Environment hängen:

```ts
import { buildSheetHtml, type SheetHtmlInput } from '@/application/export/sheetHtml';
import { WinnerSide, type Game } from '@/domain/models/game';
import type { GameSheet } from '@/domain/models/gameSheet';
import type { Player } from '@/domain/models/player';
import { BockLevel } from '@/domain/scoring/bockLevel';
import type { GameScore } from '@/domain/scoring/scoreCalculator';

const AT = new Date('2026-09-09T10:00:00.000Z');

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

function sheet(games: ReadonlyArray<Game>): GameSheet {
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

    // Der Solist steht allein auf der Re-Seite, und der Gegenwert der
    // Kontra-Partei wird als Zusatz ausgewiesen.
    expect(html).toContain('>Jan</div>');
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
```

> **Hinweis an den Ausführenden:** Die Solo-Assertion ist die weichste — die genaue Markup-Form hängt davon ab, wie `names()` die Re-Seite rendert. Wenn sie beim ersten Lauf nicht greift, schau in das erzeugte HTML und ziehe die Assertion auf die Stelle nach, die den Solisten tatsächlich ausweist, statt den Test zu löschen. Der Maskierungs-Test ist der wichtigste der sieben: ein Spielername wie `Jan & <b>Andy</b>` darf im PDF nicht als Markup landen.

- [ ] **Step 5: Run the tests**

Run: `npx jest __tests__/application/sheetHtml.test.ts`
Expected: PASS, 7 Tests.

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/application/export/sheetHtml.ts src/data/export/pdfShare.ts __tests__/application/sheetHtml.test.ts
git commit -m "refactor(export): Bogen-HTML in die Anwendungsschicht heben

Reiner Umzug, kein Verhaltenswechsel. Die ~170 Zeilen HTML-Bau waren
modul-privat und ungetestet; jetzt pur, exportiert und von sieben Tests
gedeckt. Bereitet den Web-PDF-Adapter vor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `pdfShare.web` — Drucken im Browser

**Files:**
- Create: `src/data/export/pdfShare.web.ts`
- Create: `__tests__/data/pdfShareWeb.test.ts`

**Interfaces:**
- Consumes: `renderSheetHtml(sheetId)` aus Task 3.
- Produces: `sharePdf(sheetId: string, doc?: Document): Promise<void>` — signaturgleich mit dem nativen Adapter, `SheetScreen.tsx:266` bleibt unverändert.

- [ ] **Step 1: Write the failing test**

`__tests__/data/pdfShareWeb.test.ts`:

```ts
import { sharePdf } from '@/data/export/pdfShare.web';

jest.mock('@/application/export/sheetHtml', () => ({
  renderSheetHtml: jest.fn(async () => ({
    html: '<html><body>Bogen</body></html>',
    filename: 'bockzettel-test-2026-09-09.pdf',
  })),
}));

interface FakeFrame {
  style: Record<string, string>;
  srcdoc: string;
  contentWindow: { focus: () => void; print: () => void } | null;
  addEventListener: (name: string, fn: () => void) => void;
  remove: () => void;
  fire: (name: string) => void;
}

/**
 * Laesst die Microtask-Queue durchlaufen. Noetig, weil `sharePdf` erst
 * `renderSheetHtml` abwartet und den `load`-Handler folglich nicht
 * synchron registriert — ohne dieses Flush ginge das gefeuerte Event ins
 * Leere und der Test liefe in den Timeout.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function fakeDocument(): { doc: Document; frame: FakeFrame; print: jest.Mock } {
  const handlers = new Map<string, () => void>();
  const print = jest.fn();
  const frame: FakeFrame = {
    style: {},
    srcdoc: '',
    contentWindow: { focus: () => {}, print },
    addEventListener: (name, fn) => {
      handlers.set(name, fn);
    },
    remove: () => {},
    fire: (name) => handlers.get(name)?.(),
  };
  const doc = {
    createElement: () => frame,
    body: { appendChild: () => {} },
  } as unknown as Document;
  return { doc, frame, print };
}

describe('sharePdf (web)', () => {
  it('schreibt das gerenderte HTML in das iframe und druckt es', async () => {
    const { doc, frame, print } = fakeDocument();

    const pending = sharePdf('sheet-1', doc);
    await flush();
    frame.fire('load');
    await pending;

    expect(frame.srcdoc).toContain('Bogen');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('raeumt das iframe nach dem Drucken wieder ab', async () => {
    const { doc, frame } = fakeDocument();
    const remove = jest.fn();
    frame.remove = remove;

    const pending = sharePdf('sheet-1', doc);
    await flush();
    frame.fire('load');
    await pending;

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('wirft, wenn das iframe kein contentWindow bekommt', async () => {
    const { doc, frame } = fakeDocument();
    frame.contentWindow = null;

    const pending = sharePdf('sheet-1', doc);
    await flush();
    frame.fire('load');

    await expect(pending).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/data/pdfShareWeb.test.ts`
Expected: FAIL — Modul fehlt.

- [ ] **Step 3: Write the implementation**

`src/data/export/pdfShare.web.ts`:

```ts
import { renderSheetHtml } from '@/application/export/sheetHtml';

/**
 * Web-Variante: es gibt keinen PDF-Renderer im Browser, also uebernimmt
 * das der Druckdialog. Das HTML geht in ein verstecktes iframe, dessen
 * Fenster gedruckt wird; „Als PDF speichern" ist dort ein Standard-Ziel.
 *
 * Bewusst kein Blob-Download: der Nutzer soll das Ergebnis sehen, bevor er
 * es ablegt, und bekommt so auf jeder Plattform denselben Dialog.
 */
export async function sharePdf(
  sheetId: string,
  doc: Document = globalThis.document,
): Promise<void> {
  const { html } = await renderSheetHtml(sheetId);

  return new Promise<void>((resolve, reject) => {
    const frame = doc.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';

    frame.addEventListener('load', () => {
      const fenster = frame.contentWindow;
      if (fenster === null) {
        frame.remove();
        reject(new Error('Druckvorschau konnte nicht geoeffnet werden.'));
        return;
      }
      fenster.focus();
      fenster.print();
      frame.remove();
      resolve();
    });

    frame.srcdoc = html;
    doc.body.appendChild(frame);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/data/pdfShareWeb.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/data/export/pdfShare.web.ts __tests__/data/pdfShareWeb.test.ts
git commit -m "feat(export): PDF-Export im Browser ueber den Druckdialog

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `fileShare.web` — JSON-Export im Browser

Der letzte Baustein des Canvas-Kriteriums. Danach kann ein Browser-Nutzer exportieren, die Datei weitergeben und sie auf jedem Ziel wieder importieren.

**Files:**
- Create: `src/data/export/fileShare.web.ts`
- Create: `__tests__/data/fileShareWeb.test.ts`

Keine i18n-Änderung: die einzige neue Zeichenkette ist eine Fehlermeldung auf einem Pfad, den die Oberfläche gar nicht anbietet (siehe Step 5).

**Interfaces:**
- Consumes: `ExportFile` aus `@/application/export/exportTypes` (bereits vorhanden).
- Produces: `shareExport(file: ExportFile, doc?: Document): Promise<void>` und `saveExportToFile(file: ExportFile): Promise<SaveExportResult>` — signaturgleich mit `fileShare.ts`, damit `SettingsScreen`, `SheetScreen` und `GroupManagementScreen` unverändert bleiben.

- [ ] **Step 1: Write the failing test**

`__tests__/data/fileShareWeb.test.ts`:

```ts
import { saveExportToFile, shareExport } from '@/data/export/fileShare.web';
import type { ExportFile } from '@/application/export/exportTypes';

function exportFile(): ExportFile {
  return {
    suggestedFilename: 'bockzettel-backup-2026-09-09.json',
    envelope: { app: 'doppelkopf_schreiber', formatVersion: 1 } as ExportFile['envelope'],
  };
}

interface FakeAnchor {
  href: string;
  download: string;
  style: { display: string };
  click: jest.Mock;
  remove: jest.Mock;
}

function fakeDocument(): { doc: Document; anchor: FakeAnchor } {
  const anchor: FakeAnchor = {
    href: '',
    download: '',
    style: { display: '' },
    click: jest.fn(),
    remove: jest.fn(),
  };
  const doc = {
    createElement: () => anchor,
    body: { appendChild: () => {} },
  } as unknown as Document;
  return { doc, anchor };
}

describe('shareExport (web)', () => {
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it('loest einen Download mit dem vorgeschlagenen Dateinamen aus', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:http://x/9') as typeof URL.createObjectURL;
    URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
    const { doc, anchor } = fakeDocument();

    await shareExport(exportFile(), doc);

    expect(anchor.download).toBe('bockzettel-backup-2026-09-09.json');
    expect(anchor.href).toBe('blob:http://x/9');
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });

  it('gibt die Objekt-URL wieder frei', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:http://x/9') as typeof URL.createObjectURL;
    const revoke = jest.fn();
    URL.revokeObjectURL = revoke as typeof URL.revokeObjectURL;
    const { doc } = fakeDocument();

    await shareExport(exportFile(), doc);

    expect(revoke).toHaveBeenCalledWith('blob:http://x/9');
  });
});

describe('saveExportToFile (web)', () => {
  it('meldet, dass es im Browser kein Verzeichnis-Ziel gibt', async () => {
    await expect(saveExportToFile(exportFile())).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/data/fileShareWeb.test.ts`
Expected: FAIL — Modul fehlt.

- [ ] **Step 3: Write the implementation**

`src/data/export/fileShare.web.ts`:

```ts
import type { ExportFile } from '@/application/export/exportTypes';
import type { SaveExportResult } from '@/data/export/fileShare';

export type { SaveExportResult };

/**
 * Web-Variante: der Browser kennt kein Share-Sheet fuer Dateien, also wird
 * der Envelope als Blob heruntergeladen. Wohin er landet, entscheidet die
 * Download-Einstellung des Browsers.
 *
 * Das Gegenstueck ist `fileShare.ts`; Metro waehlt anhand des
 * `.web`-Suffixes aus.
 */
export async function shareExport(
  file: ExportFile,
  doc: Document = globalThis.document,
): Promise<void> {
  const json = JSON.stringify(file.envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = file.suggestedFilename;
    anchor.style.display = 'none';
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Erst nach dem Klick freigeben, sonst zieht der Browser die Quelle
    // unter dem laufenden Download weg.
    URL.revokeObjectURL(url);
  }
}

/**
 * Im Browser gibt es kein Gegenstueck zum Storage Access Framework — die
 * Oberflaeche blendet diesen Knopf ohnehin nur unter Android ein
 * (`Platform.OS === 'android'`), also ist dieser Wurf reine Absicherung
 * gegen einen Aufruf, den es nicht geben sollte.
 */
export function saveExportToFile(_file: ExportFile): Promise<SaveExportResult> {
  return Promise.reject(
    new Error('Speichern unter... ist im Browser nicht verfuegbar; benutze den Export.'),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/data/fileShareWeb.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Check the download-hint copy**

Auf Android heißt der Knopf „Backup teilen", sonst „Backup exportieren" (`SettingsScreen.tsx:110-112`). Im Browser ist „exportieren" korrekt — keine Textänderung nötig. Prüfen und bestätigen, **nicht** ändern: der Canvas verbietet GUI-Änderungen, die nicht auf Speichern/Laden/Import/Export einzahlen.

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/data/export/fileShare.web.ts __tests__/data/fileShareWeb.test.ts
git commit -m "feat(export): JSON-Export im Browser als Blob-Download

Schliesst das Erfolgskriterium des Use-Case-Canvas: Speichern, Laden und
Export/Import funktionieren jetzt auch im HTML-Ziel.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Manuelle Verifikation im Browser

Die Unit-Tests decken die Adapter ab, aber nicht das Zusammenspiel. Das hier ist der Punkt, an dem der Canvas als erfüllt gilt oder nicht.

**Files:** keine.

- [ ] **Step 1: Start the web target**

Run: `npm run web`
Erwartung: die App öffnet im Browser, jeder Screen erreichbar.

- [ ] **Step 2: Round-trip the data**

1. Einen Spielbogen anlegen und zwei Spiele erfassen.
2. Seite neu laden — die Daten sind noch da (IndexedDB-Pfad, Task aus dem Storage-Branch).
3. Einstellungen → „Backup exportieren" — die JSON-Datei landet im Download-Ordner.
4. Browser-Daten löschen, Seite neu laden — die App ist leer.
5. Einstellungen → „Import..." — die eben heruntergeladene Datei wählen.
6. Der Import-Review-Screen zeigt Spieler, Bögen und Einstellungen; „Übernehmen".
7. Der Bogen ist zurück und **die Erfassung lässt sich fortsetzen** — ein weiteres Spiel eintragen.

- [ ] **Step 3: PDF**

Auf einem Bogen „Als PDF teilen..." — der Druckdialog des Browsers öffnet sich mit dem korrekten Bogen, inklusive Summenzeile.

- [ ] **Step 4: Native darf nicht regressieren**

Run: `npm run android` (Windows) bzw. `npm run ios` (macOS)
Erwartung: Build läuft durch, Export/Import/PDF verhalten sich unverändert.

- [ ] **Step 5: Record the result**

Das Ergebnis in `docs/superpowers/specs/2026-09-09-web-target-design.md` unter „Verification checklist" als abgehakt vermerken (Punkte 2–5 und 9), mit Datum und Umgebung.

```bash
git add docs/superpowers/specs/2026-09-09-web-target-design.md
git commit -m "docs: Web-Export/Import gegen die Checkliste verifiziert

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Nicht in diesem Plan

Das Spec deckt ein zweites, unabhängiges Subsystem ab: **Build und Deploy** — `baseUrl`, `.nojekyll`, `scripts/postexport.mjs`, Service Worker, `manifest.webmanifest`, das Single-File-`bockzettel-offline.html`, die CI-Jobs `web-build`/`deploy`/`release`. Das gehört in einen eigenen Plan (`2026-09-09-web-deploy.md`), weil es nach diesem hier lauffähige, testbare Software gibt und die beiden Teile sich nicht gegenseitig blockieren.

Ebenfalls bewusst draußen, als bewusste Nicht-Änderung aus dem Spec („Deliberate non-change"): Die gewählte Datei reist weiterhin als URI durch den Navigations-Parameter von `SettingsScreen` zu `ImportReviewScreen`. Im Web ist das eine `blob:`-URL, die nur so lange lebt wie das Dokument — ein harter Reload auf der Import-Review-Route verliert sie. Der native Build hat dasselbe Loch mit Cache-URIs. Stattdessen den Datei-*Inhalt* durch den Parameter zu reichen wäre sauberer, würde aber `RootStackParamList` aufwühlen; nicht den Preis wert.

Und weil der Canvas es ausschließt:

- `edgeToEdgeEnabled` aus `app.json:24` entfernen (Expo-Prebuild-Warnung, reine Aufräumsache).
- Die 101 `@typescript-eslint/array-type`-Warnungen.
