import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABEL, SONG_CATEGORIES, type SongCategory } from '@/constants/categories';
import { Fonts, type AppPalette } from '@/constants/theme';
import { useThemedStyles } from '@/providers/theme';

interface CategoryPickerProps {
  value: SongCategory | null;
  /** Tapping the selected type again clears it. */
  onChange: (category: SongCategory | null) => void;
}

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      {SONG_CATEGORIES.map((category) => {
        const selected = category === value;
        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onChange(selected ? null : category)}>
            <Text style={[styles.text, selected && styles.textSelected]}>{CATEGORY_LABEL[category]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    option: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    text: {
      color: colors.text,
      fontFamily: Fonts.serif,
      fontSize: 16,
    },
    textSelected: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
  });
