/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const AppColors = {
  background: '#F2F6F6',
  surface: '#FFFFFF',
  surfaceMuted: '#E2EBEB',
  primary: '#1F8884',
  primaryStrong: '#196D69',
  primarySoft: '#CFE2E1',
  text: '#121A33',
  textMuted: '#60758B',
  border: '#C7D8D8',
  tabInactive: '#9CADC0',
  shadow: 'rgba(17, 34, 57, 0.12)',
};

const tintColorLight = AppColors.primary;
const tintColorDark = '#CFE2E1';

export const Colors = {
  light: {
    text: AppColors.text,
    background: AppColors.background,
    tint: tintColorLight,
    icon: AppColors.textMuted,
    tabIconDefault: AppColors.tabInactive,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#E8EEF2',
    background: '#0F171A',
    tint: tintColorDark,
    icon: '#8FA5B8',
    tabIconDefault: '#8FA5B8',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif-medium',
    mono: 'monospace',
  },
  web: {
    sans: "'Avenir Next', 'Segoe UI', sans-serif",
    serif: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    rounded: "'Avenir Next', 'Segoe UI', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
