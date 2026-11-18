import { sharePromptText } from '@/data/share/sharePromptText.web';

describe('sharePromptText (web)', () => {
  test('kopiert den Text in die Zwischenablage', async () => {
    const written: string[] = [];
    const clipboard = {
      writeText: async (text: string) => {
        written.push(text);
      },
    };
    await expect(sharePromptText('Hallo Prompt', clipboard)).resolves.toBe('copied');
    expect(written).toEqual(['Hallo Prompt']);
  });

  test('wirft, wenn keine Zwischenablage verfuegbar ist', async () => {
    await expect(sharePromptText('x', undefined)).rejects.toThrow();
  });

  test('reicht Fehler der Zwischenablage weiter', async () => {
    const clipboard = {
      writeText: async () => {
        throw new Error('verweigert');
      },
    };
    await expect(sharePromptText('x', clipboard)).rejects.toThrow('verweigert');
  });
});
