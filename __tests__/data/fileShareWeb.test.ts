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
    let captured: Blob | null = null;
    URL.createObjectURL = jest.fn((b: Blob) => {
      captured = b;
      return 'blob:http://x/9';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
    const { doc, anchor } = fakeDocument();

    await shareExport(exportFile(), doc);

    expect(anchor.download).toBe('bockzettel-backup-2026-09-09.json');
    expect(anchor.href).toBe('blob:http://x/9');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(captured).not.toBeNull();
    expect(captured!.type).toBe('application/json');
  });

  it('serialisiert den Envelope als JSON mit korrekter Formatierung', async () => {
    let captured: Blob | null = null;
    URL.createObjectURL = jest.fn((b: Blob) => {
      captured = b;
      return 'blob:http://x/9';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
    const { doc } = fakeDocument();
    const file = exportFile();

    await shareExport(file, doc);

    expect(captured).not.toBeNull();
    const text = await captured!.text();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual(file.envelope);
    // Prueft Pretty-Printing mit 2-Leerzeichen-Einrueckung
    expect(text).toContain('\n  ');
  });

  it('gibt die Objekt-URL verzoegert und nicht synchron frei', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:http://x/9') as typeof URL.createObjectURL;
    const revoke = jest.fn();
    URL.revokeObjectURL = revoke as typeof URL.revokeObjectURL;
    const { doc, anchor } = fakeDocument();
    const callOrder: string[] = [];

    (anchor.click as jest.Mock).mockImplementation(() => {
      callOrder.push('click');
    });
    (anchor.remove as jest.Mock).mockImplementation(() => {
      callOrder.push('remove');
    });
    (revoke as jest.Mock).mockImplementation(() => {
      callOrder.push('revoke');
    });

    const pending = shareExport(exportFile(), doc);
    // Nach click() und remove(), aber vor dem Abschluss des awaits, darf
    // revoke noch nicht aufgerufen worden sein.
    expect(callOrder).toEqual(['click', 'remove']);
    // Nach dem Warten muss revoke aufgerufen worden sein, verzoegert nach dem Tick.
    await pending;
    expect(callOrder).toEqual(['click', 'remove', 'revoke']);
    expect(revoke).toHaveBeenCalledWith('blob:http://x/9');
  });
});

describe('saveExportToFile (web)', () => {
  it('meldet, dass es im Browser kein Verzeichnis-Ziel gibt', async () => {
    await expect(saveExportToFile(exportFile())).rejects.toThrow();
  });
});
