/**
 * Jest-Mock fuer `expo-constants`. Wird in `jest.config.js` ueber
 * `moduleNameMapper` aktiv. Liefert minimale, deterministische Werte;
 * Tests, die echte App-Werte brauchen, koennen den Mock per `jest.mock`
 * im Testfile ueberschreiben.
 */
const Constants = {
  expoConfig: {
    version: '0.1.0-test',
  },
};

export default Constants;
