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
