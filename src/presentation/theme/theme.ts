import {
  argbFromHex,
  hexFromArgb,
  Scheme,
} from '@material/material-color-utilities';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const SEED = '#0D47A1';

function paperColorsFromScheme(
  scheme: Scheme,
  defaults: MD3Theme['colors'],
): MD3Theme['colors'] {
  const h = (argb: number) => hexFromArgb(argb);
  return {
    ...defaults,
    primary: h(scheme.primary),
    onPrimary: h(scheme.onPrimary),
    primaryContainer: h(scheme.primaryContainer),
    onPrimaryContainer: h(scheme.onPrimaryContainer),
    secondary: h(scheme.secondary),
    onSecondary: h(scheme.onSecondary),
    secondaryContainer: h(scheme.secondaryContainer),
    onSecondaryContainer: h(scheme.onSecondaryContainer),
    tertiary: h(scheme.tertiary),
    onTertiary: h(scheme.onTertiary),
    tertiaryContainer: h(scheme.tertiaryContainer),
    onTertiaryContainer: h(scheme.onTertiaryContainer),
    error: h(scheme.error),
    onError: h(scheme.onError),
    errorContainer: h(scheme.errorContainer),
    onErrorContainer: h(scheme.onErrorContainer),
    background: h(scheme.background),
    onBackground: h(scheme.onBackground),
    surface: h(scheme.surface),
    onSurface: h(scheme.onSurface),
    surfaceVariant: h(scheme.surfaceVariant),
    onSurfaceVariant: h(scheme.onSurfaceVariant),
    outline: h(scheme.outline),
    outlineVariant: h(scheme.outlineVariant),
    shadow: h(scheme.shadow),
    scrim: h(scheme.scrim),
    inverseSurface: h(scheme.inverseSurface),
    inverseOnSurface: h(scheme.inverseOnSurface),
    inversePrimary: h(scheme.inversePrimary),
  };
}

const seedArgb = argbFromHex(SEED);

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: paperColorsFromScheme(Scheme.light(seedArgb), MD3LightTheme.colors),
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: paperColorsFromScheme(Scheme.dark(seedArgb), MD3DarkTheme.colors),
};
