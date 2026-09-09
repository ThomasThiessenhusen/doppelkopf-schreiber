import type { LocalStorage } from '@/data/local/localStorage';

/**
 * Waehlt die erste benutzbare `LocalStorage`-Implementierung aus einer
 * geordneten Liste von Kandidaten.
 *
 * Warum mit Timeout und nicht einfach `try/catch`: IndexedDB meldet auf einem
 * opaken Origin — etwa einer aus dem Dateisystem geoeffneten HTML-Datei —
 * nicht zwingend einen Fehler. Der `open`-Request kann stattdessen einfach
 * nie einen Callback ausloesen. Ein `catch` griffe dort nie und die App wuerde
 * beim Start haengen bleiben, statt auf die naechste Ebene zu wechseln.
 * Deshalb gilt: kein Ergebnis innerhalb des Timeouts = nicht benutzbar.
 *
 * Der haengende Promise wird dabei nicht abgebrochen (das kann man mit
 * Promises nicht), sondern nur nicht mehr abgewartet.
 */
const DEFAULT_TIMEOUT_MS = 3000;

export interface StorageCandidate {
  name: string;
  open: () => Promise<LocalStorage>;
}

export interface SelectedStorage {
  name: string;
  storage: LocalStorage;
}

export interface SelectStorageOptions {
  timeoutMs?: number;
}

export async function selectStorage(
  candidates: readonly StorageCandidate[],
  opts: SelectStorageOptions = {},
): Promise<SelectedStorage> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const gescheitert: string[] = [];

  for (const candidate of candidates) {
    try {
      const storage = await withTimeout(candidate.open(), timeoutMs);
      return { name: candidate.name, storage };
    } catch {
      gescheitert.push(candidate.name);
    }
  }

  throw new Error(
    `Kein benutzbarer Storage gefunden. Gescheiterte Kandidaten: ${gescheitert.join(', ') || '(keine)'}`,
  );
}

const TIMED_OUT = Symbol('timed-out');

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
  });

  try {
    const ergebnis = await Promise.race([promise, timeout]);
    if (ergebnis === TIMED_OUT) {
      throw new Error(`Kein Ergebnis innerhalb von ${timeoutMs} ms.`);
    }
    return ergebnis;
  } finally {
    // Timer aufraeumen, sonst haelt er den Node-Prozess (und Jest) offen.
    if (timer !== undefined) clearTimeout(timer);
  }
}
