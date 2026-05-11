import * as Crypto from 'expo-crypto';

/**
 * Generiert eine neue eindeutige ID (UUID v4).
 *
 * Nutzt `expo-crypto.randomUUID()` — funktioniert cross-platform (Node fuer
 * Jest-Tests, React Native Hermes/JSC fuer App-Runtime, Web). `globalThis.crypto`
 * ist im RN-JS-Engine nicht garantiert vorhanden, deshalb gehen wir ueber
 * Expo's Polyfill-Wrapper.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
