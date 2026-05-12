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

const seedHct = Hct.fromInt(argbFromHex(SEED));

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: paperColorsFromScheme(
    new SchemeTonalSpot(seedHct, false, 0),
    MD3LightTheme.colors,
  ),
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: paperColorsFromScheme(
    new SchemeTonalSpot(seedHct, true, 0),
    MD3DarkTheme.colors,
  ),
};
