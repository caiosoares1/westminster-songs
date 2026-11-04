// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SFSymbol, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

type IconMapping = Partial<Record<SFSymbol, ComponentProps<typeof MaterialIcons>['name']>>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'music.note.list': 'queue-music',
  'list.bullet': 'format-list-bulleted',
  'gearshape.fill': 'settings',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} satisfies IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // @expo/vector-icons still types `color` as string | OpaqueColorValue; it is
  // forwarded to <Text>, which accepts any ColorValue.
  const iconColor = color as ComponentProps<typeof MaterialIcons>['color'];
  return <MaterialIcons color={iconColor} size={size} name={MAPPING[name]} style={style} />;
}
