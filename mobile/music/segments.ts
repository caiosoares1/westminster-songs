import type { SongLine } from '@/services/songs';

export interface ChordSegment {
  chord: string | null;
  lyric: string;
}

/**
 * Groups a line into segments of "chord above the lyric that follows it".
 *
 * Each segment is rendered as its own column, so the chord stays over the
 * right syllable whatever the font (the lyrics use a proportional serif font,
 * so aligning by character columns would drift).
 */
export function buildSegments(line: SongLine): ChordSegment[] {
  const segments: ChordSegment[] = [];

  for (const item of line.items) {
    if (item.type === 'chord') {
      segments.push({ chord: item.value, lyric: '' });
      continue;
    }

    const last = segments[segments.length - 1];
    if (last && last.lyric === '') {
      last.lyric = item.value;
    } else {
      segments.push({ chord: null, lyric: item.value });
    }
  }

  return segments;
}
