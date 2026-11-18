import {
  argbFromHex,
  type DynamicScheme,
  Hct,
  hexFromArgb,
  SchemeTonalSpot,
} from '@material/material-color-utilities';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const SEED = '#0D47A1';

function paperColorsFromScheme(
  scheme: DynamicScheme,
  defaults: MD3Theme['colors'],
): MD3Theme['colors'] {
  return {
    ...defaults,
    primary: hexFromArgb(scheme.primary),
    onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer),
    onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
    secondary: hexFromArgb(scheme.secondary),
    onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer),
    onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
    tertiary: hexFromArgb(scheme.tertiary),
    onTertiary: hexFromArgb(scheme.onTertiary),
    tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),
    error: hexFromArgb(scheme.error),
    onError: hexFromArgb(scheme.onError),
    errorContainer: hexFromArgb(scheme.errorContainer),
    onErrorContainer: hexFromArgb(scheme.onErrorContainer),
    background: hexFromArgb(scheme.background),
    onBackground: hexFromArgb(scheme.onBackground),
    surface: hexFromArgb(scheme.surface),
    onSurface: hexFromArgb(scheme.onSurface),
    surfaceVariant: hexFromArgb(scheme.surfaceVariant),
    onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
    outline: hexFromArgb(scheme.outline),
    outlineVariant: hexFromArgb(scheme.outlineVariant),
    shadow: hexFromArgb(scheme.shadow),
    scrim: hexFromArgb(scheme.scrim),
    inverseSurface: hexFromArgb(scheme.inverseSurface),
    inverseOnSurface: hexFromArgb(scheme.inverseOnSurface),
    inversePrimary: hexFromArgb(scheme.inversePrimary),
  };
}

/** Globaler Faktor für alle Paper-Textvarianten (1 = Material-Standard). */
export const FONT_SCALE = 1.2;

function scaleFonts(fonts: MD3Theme['fonts']): MD3Theme['fonts'] {
  const entries = Object.entries(fonts).map(([key, v]) => {
    const font = v as { fontSize?: number; lineHeight?: number };
    return [
      key,
      {
        ...v,
        ...(font.fontSize !== undefined && { fontSize: Math.round(font.fontSize * FONT_SCALE) }),
        ...(font.lineHeight !== undefined && {
          lineHeight: Math.round(font.lineHeight * FONT_SCALE),
        }),
      },
    ];
  });
  return Object.fromEntries(entries) as MD3Theme['fonts'];
}

const seedHct = Hct.fromInt(argbFromHex(SEED));

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: scaleFonts(MD3LightTheme.fonts),
  colors: paperColorsFromScheme(
    new SchemeTonalSpot(seedHct, false, 0),
    MD3LightTheme.colors,
  ),
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: scaleFonts(MD3DarkTheme.fonts),
  colors: paperColorsFromScheme(
    new SchemeTonalSpot(seedHct, true, 0),
    MD3DarkTheme.colors,
  ),
};
