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
