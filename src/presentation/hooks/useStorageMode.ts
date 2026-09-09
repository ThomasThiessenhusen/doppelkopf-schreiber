import { useEffect, useState } from 'react';

import { storageMode } from '@/data/local/createStorage';

/**
 * Welcher Speicher tatsaechlich gewonnen hat — `null`, solange die Auswahl
 * noch laeuft.
 *
 * Die Auswahl passiert genau einmal pro App-Start und aendert sich danach
 * nicht mehr; `storageMode()` liefert dasselbe Promise zurueck, egal wie oft
 * es gerufen wird. Mehrere Verbraucher sind also unbedenklich.
 */
export function useStorageMode(): string | null {
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    storageMode()
      .then((m) => {
        if (!cancelled) setMode(m);
      })
      .catch(() => {
        // Findet `selectStorage` gar nichts, ist die App ohnehin nicht
        // benutzbar. Hier bleibt der Hinweis dann einfach aus, statt den
        // Renderbaum mitzureissen.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return mode;
}
