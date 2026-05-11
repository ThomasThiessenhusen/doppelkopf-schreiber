import {
  appSettingsFallback,
  appSettingsFromJson,
  appSettingsToJson,
  type AppSettings,
} from '@/domain/models/appSettings';
import { BockStackingMode } from '@/domain/scoring/bockStackingMode';

describe('AppSettings', () => {
  test('Default ist sequential', () => {
    expect(appSettingsFallback.defaultStackingMode).toBe(BockStackingMode.sequential);
  });

  test('JSON-Roundtrip erhaelt defaultStackingMode', () => {
    const settings: AppSettings = {
      defaultStackingMode: BockStackingMode.doppelbock,
      language: 'system',
    };
    const restored = appSettingsFromJson(appSettingsToJson(settings));
    expect(restored.defaultStackingMode).toBe(BockStackingMode.doppelbock);
  });

  test('fromJson mit unbekannten Feldern faellt auf Defaults zurueck', () => {
    const settings = appSettingsFromJson({});
    expect(settings.defaultStackingMode).toBe(BockStackingMode.sequential);
  });

  test('Default-Sprache ist system', () => {
    expect(appSettingsFallback.language).toBe('system');
  });

  test('JSON-Roundtrip erhaelt language', () => {
    const settings: AppSettings = {
      defaultStackingMode: BockStackingMode.sequential,
      language: 'en',
    };
    const restored = appSettingsFromJson(appSettingsToJson(settings));
    expect(restored.language).toBe('en');
  });

  test('fromJson ohne language-Feld faellt auf system zurueck', () => {
    const settings = appSettingsFromJson({
      defaultStackingMode: 'sequential',
    });
    expect(settings.language).toBe('system');
  });

  test('fromJson mit unbekanntem language-Wert faellt auf system zurueck', () => {
    const settings = appSettingsFromJson({
      defaultStackingMode: 'sequential',
      language: 'klingon',
    });
    expect(settings.language).toBe('system');
  });
});
