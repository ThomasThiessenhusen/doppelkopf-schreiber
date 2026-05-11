/**
 * Jest-Mock fuer `expo-crypto`. Nutzt Node's eingebautes `crypto.randomUUID`
 * (Node 14.17+). Wird in `jest.config.js` ueber `moduleNameMapper` aktiv —
 * App-Runtime nutzt weiterhin die echte `expo-crypto`.
 */
export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}
