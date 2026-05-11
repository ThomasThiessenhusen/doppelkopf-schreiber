/** Discriminated Union fuer ladende, fertige oder fehlgeschlagene Werte. */
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'data'; value: T }
  | { status: 'error'; error: Error };

export const asyncLoading = { status: 'loading' } as const;

export function asyncData<T>(value: T): AsyncState<T> {
  return { status: 'data', value };
}

export function asyncError(error: unknown): AsyncState<never> {
  return {
    status: 'error',
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

/** Helper: Wert aus AsyncState ziehen, falls vorhanden (sonst null). */
export function asyncValueOrNull<T>(s: AsyncState<T>): T | null {
  return s.status === 'data' ? s.value : null;
}
