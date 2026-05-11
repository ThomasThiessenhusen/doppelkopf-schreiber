/**
 * Generiert eine neue eindeutige ID (UUID v4).
 *
 * Nutzt `globalThis.crypto.randomUUID()` (Node 19+, RN 0.76+, alle modernen
 * Browser) — kein zusaetzliches npm-Paket noetig.
 */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
