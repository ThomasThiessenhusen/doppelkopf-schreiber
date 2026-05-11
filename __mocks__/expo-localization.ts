/**
 * Jest-Mock fuer `expo-localization`. Gibt eine fixe en-US-Locale zurueck.
 * Wird in `jest.config.js` ueber `moduleNameMapper` aktiv —
 * App-Runtime nutzt weiterhin die echte `expo-localization`.
 */
export function getLocales() {
  return [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      languageScriptCode: 'Latn',
      regionCode: 'US',
      languageRegionCode: 'US',
      currencyCode: 'USD',
      currencySymbol: '$',
      languageCurrencyCode: 'USD',
      languageCurrencySymbol: '$',
      decimalSeparator: '.',
      digitGroupingSeparator: ',',
      textDirection: 'ltr',
      measurementSystem: 'us',
      temperatureUnit: 'fahrenheit',
    },
  ] as const;
}

export function getCalendars() {
  return [
    {
      calendar: 'gregory',
      uses24hourClock: true,
      firstWeekday: 1,
      timeZone: 'America/New_York',
    },
  ] as const;
}
