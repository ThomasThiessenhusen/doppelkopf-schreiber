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
    };
    const restored = appSettingsFromJson(appSettingsToJson(settings));
    expect(restored.defaultStackingMode).toBe(BockStackingMode.doppelbock);
  });

  test('fromJson mit unbekannten Feldern faellt auf Defaults zurueck', () => {
    const settings = appSettingsFromJson({});
    expect(settings.defaultStackingMode).toBe(BockStackingMode.sequential);
  });
});
