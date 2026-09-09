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
