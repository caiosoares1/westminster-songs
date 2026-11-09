/** App colors for the light and dark themes (chosen in providers/theme). */

import { Platform } from 'react-native';

export interface AppPalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  /** Text and icons on top of `primary` (buttons, selected chips). */
  onPrimary: string;
  text: string;
  textMuted: string;
  border: string;
  tabInactive: string;
  shadow: string;
  danger: string;
}

export const LightColors: AppPalette = {
  background: '#F2F6F6',
  surface: '#FFFFFF',
  surfaceMuted: '#E2EBEB',
  primary: '#1F8884',
  primaryStrong: '#196D69',
  primarySoft: '#CFE2E1',
  onPrimary: '#FFFFFF',
  text: '#121A33',
  textMuted: '#60758B',
  border: '#C7D8D8',
  tabInactive: '#9CADC0',
  shadow: 'rgba(17, 34, 57, 0.12)',
  danger: '#B3261E',
};

// Dark: same teal identity, lighter so it reads on a dark background;
// buttons get dark text for contrast.
export const DarkColors: AppPalette = {
  background: '#0E1517',
  surface: '#172124',
  surfaceMuted: '#223035',
  primary: '#4DB6AF',
  primaryStrong: '#7DD3CC',
  primarySoft: '#1D3A39',
  onPrimary: '#06201F',
  text: '#E6EDF0',
  textMuted: '#93A7B3',
  border: '#2A3B40',
  tabInactive: '#6B8290',
  shadow: 'rgba(0, 0, 0, 0.45)',
  danger: '#F28B82',
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
