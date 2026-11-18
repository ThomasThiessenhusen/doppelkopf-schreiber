interface ClipboardLike {
  writeText: (text: string) => Promise<void>;
}

/**
 * Web-Variante: kopiert den Text in die Zwischenablage. Die Zwischenablage
 * kommt als Parameter herein, damit der Test ohne Browser auskommt.
 * Ohne Clipboard-API wirft die Funktion, die UI zeigt dann einen Fehlertext.
 */
export async function sharePromptText(
  text: string,
  clipboard: ClipboardLike | undefined = globalThis.navigator?.clipboard,
): Promise<'shared' | 'copied' | 'cancelled'> {
  if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
    throw new Error('Zwischenablage nicht verfuegbar.');
  }
  await clipboard.writeText(text);
  return 'copied';
}
