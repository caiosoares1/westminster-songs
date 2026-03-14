import { StyleSheet, Text, View } from 'react-native';

import { AppColors, Fonts } from '@/constants/theme';
import type { SongLine } from '@/services/songs';

interface ChordLineProps {
  line: SongLine;
}

function buildAlignedRows(line: SongLine): { chordRow: string; lyricRow: string } {
  let chordRow = '';
  let lyricRow = '';

  for (const item of line.items) {
    if (item.type === 'chord') {
      chordRow += item.value;
      lyricRow += ' '.repeat(item.value.length);
      continue;
    }

    chordRow += ' '.repeat(item.value.length);
    lyricRow += item.value;
  }

  return {
    chordRow: chordRow.trimEnd(),
    lyricRow: lyricRow.trimEnd(),
  };
}

export default function ChordLine({ line }: ChordLineProps) {
  const { chordRow, lyricRow } = buildAlignedRows(line);

  return (
    <View style={styles.container}>
      <Text style={styles.chords}>{chordRow || ' '}</Text>
      <Text style={styles.lyrics}>{lyricRow || ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  chords: {
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: AppColors.primary,
  },
  lyrics: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 31,
    color: AppColors.text,
  },
});
