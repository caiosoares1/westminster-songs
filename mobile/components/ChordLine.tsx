import { StyleSheet, Text, View } from 'react-native';

import { Fonts, type AppPalette } from '@/constants/theme';
import { useThemedStyles } from '@/providers/theme';
import { buildSegments } from '@/music/segments';
import type { SongLine } from '@/services/songs';

interface ChordLineProps {
  line: SongLine;
}

export default function ChordLine({ line }: ChordLineProps) {
  const styles = useThemedStyles(createStyles);
  const segments = buildSegments(line);
  const hasChords = segments.some((segment) => segment.chord);
  const hasLyrics = segments.some((segment) => segment.lyric.trim());

  return (
    <View style={styles.row}>
      {segments.map((segment, index) => (
        <View key={index} style={styles.segment}>
          {hasChords ? (
            <Text style={styles.chord}>{segment.chord ? `${segment.chord} ` : ' '}</Text>
          ) : null}
          {hasLyrics ? <Text style={styles.lyric}>{segment.lyric || ' '}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: AppPalette) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  segment: {
    flexDirection: 'column',
  },
  chord: {
    fontFamily: Fonts.mono,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  lyric: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    color: colors.text,
  },
});
