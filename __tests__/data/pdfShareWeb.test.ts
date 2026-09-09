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
