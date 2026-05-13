/**
 * Serialisiert asynchrone Operationen pro Schluessel.
 *
 * Operationen mit demselben Schluessel laufen strikt nacheinander; Operationen
 * mit unterschiedlichen Schluesseln laufen unabhaengig parallel. Geworfene
 * Fehler einer Operation brechen die Kette des Schluessels *nicht* ab — die
 * naechste Operation startet auch nach einem Wurf der vorherigen.
 *
 * Wird in `jsonFileStorage` verwendet, um die write/delete-Sequenz pro
 * Collection+ID zu serialisieren und so eine Race zwischen `writeAsStringAsync`
 * und `moveAsync` zweier parallel laufender Schreibvorgaenge zu verhindern.
 */
export interface PerKeyLock {
  run<T>(key: string, op: () => Promise<T>): Promise<T>;
}

export function createPerKeyLock(): PerKeyLock {
  const tails = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, op: () => Promise<T>): Promise<T> {
      const prev = tails.get(key) ?? Promise.resolve();
      const run: Promise<T> = prev.then(op, op);
      const gate: Promise<unknown> = run.catch(() => undefined);
      tails.set(key, gate);
      void gate.then(() => {
        if (tails.get(key) === gate) tails.delete(key);
      });
      return run;
    },
  };
}
