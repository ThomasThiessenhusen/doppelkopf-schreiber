import { createPerKeyLock } from '@/data/local/perKeyLock';

/** Manuell aufloesbares Promise zum Steuern der Reihenfolge. */
function defer<T = void>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createPerKeyLock', () => {
  test('serialisiert Operationen mit demselben Schluessel', async () => {
    const lock = createPerKeyLock();
    const order: string[] = [];
    const d1 = defer<void>();
    const d2 = defer<void>();

    const p1 = lock.run('k', async () => {
      order.push('start-1');
      await d1.promise;
      order.push('end-1');
    });
    const p2 = lock.run('k', async () => {
      order.push('start-2');
      await d2.promise;
      order.push('end-2');
    });

    // Auch wenn beide gestartet sind, darf #2 erst nach #1 laufen.
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['start-1']);

    d1.resolve();
    await p1;
    await Promise.resolve();
    expect(order).toEqual(['start-1', 'end-1', 'start-2']);

    d2.resolve();
    await p2;
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  test('laeuft fuer unterschiedliche Schluessel parallel', async () => {
    const lock = createPerKeyLock();
    const order: string[] = [];
    const d1 = defer<void>();
    const d2 = defer<void>();

    const p1 = lock.run('a', async () => {
      order.push('start-a');
      await d1.promise;
      order.push('end-a');
    });
    const p2 = lock.run('b', async () => {
      order.push('start-b');
      await d2.promise;
      order.push('end-b');
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(order).toContain('start-a');
    expect(order).toContain('start-b');

    // In beliebiger Reihenfolge aufloesen.
    d2.resolve();
    await p2;
    d1.resolve();
    await p1;

    expect(new Set(order)).toEqual(new Set(['start-a', 'end-a', 'start-b', 'end-b']));
  });

  test('ein Fehler bricht die Kette desselben Schluessels nicht ab', async () => {
    const lock = createPerKeyLock();
    const errored = lock.run('k', async () => {
      throw new Error('boom');
    });
    await expect(errored).rejects.toThrow('boom');

    const followup = await lock.run('k', async () => 'ok');
    expect(followup).toBe('ok');
  });

  test('gibt nach Abschluss internen Lock-Eintrag wieder frei', async () => {
    const lock = createPerKeyLock();
    await lock.run('k', async () => 1);
    // Tail sollte aufgeraeumt sein — weiterer Aufruf laeuft sofort.
    const start = Date.now();
    await lock.run('k', async () => 2);
    expect(Date.now() - start).toBeLessThan(50);
  });

  test('liefert den Rueckgabewert der Operation', async () => {
    const lock = createPerKeyLock();
    const v = await lock.run('k', async () => 42);
    expect(v).toBe(42);
  });
});
