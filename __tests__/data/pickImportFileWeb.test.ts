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
