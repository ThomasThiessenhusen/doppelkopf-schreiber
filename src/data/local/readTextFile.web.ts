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
