import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const SEED = '#1B5E20';

/** App-Light-Theme — Material 3, Seed-Color Dunkelgruen. */
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: SEED,
  },
};

/** App-Dark-Theme — Material 3 Dark, Seed-Color Dunkelgruen. */
export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: SEED,
  },
};
