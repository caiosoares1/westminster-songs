import type { SongItem, SongLine, SongSection, SongStructure } from '@/services/songs';

/**
 * Fills stanzas that have only lyrics with the chords of a stanza that has
 * them. Metrical psalms and hymns repeat the melody in every stanza, so a
 * chord falls on the same syllable of the corresponding line, even though
 * the words change. Positions are mapped by syllable, not by character.
 */

const VOWELS = 'aeiouáéíóúâêôãõàüyAEIOUÁÉÍÓÚÂÊÔÃÕÀÜY';
// Consonant pairs that start a syllable together ("pra", "cla", "nha").
const ONSET_CLUSTERS = new Set([
  'pr', 'br', 'tr', 'dr', 'cr', 'gr', 'fr', 'vr',
  'pl', 'bl', 'cl', 'gl', 'fl', 'ch', 'lh', 'nh', 'qu', 'gu',
]);

const isVowel = (character: string) => VOWELS.includes(character);
const isLetter = (character: string) => /\p{L}/u.test(character);

/**
 * Index where each sung syllable starts in the text (approximate Portuguese
 * syllabification: one syllable per vowel group).
 */
export function syllableStarts(text: string): number[] {
  const nuclei: { start: number; end: number }[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (!isVowel(text[index])) continue;
    const start = index;
    while (index + 1 < text.length && isVowel(text[index + 1])) index += 1;
    nuclei.push({ start, end: index });
  }

  return nuclei.map((nucleus, position) => {
    const previousEnd = position === 0 ? -1 : nuclei[position - 1].end;
    // Consonants between the previous vowel group and this one.
    let onset = nucleus.start;
    while (onset - 1 > previousEnd && isLetter(text[onset - 1]) && !isVowel(text[onset - 1])) {
      onset -= 1;
    }
    // Inside a word, only the last consonant (or a cluster like "pr") opens
    // the syllable: "for-ta-le-za", "pa-la-vra".
    if (position > 0 && /^\p{L}+$/u.test(text.slice(previousEnd + 1, nucleus.start))) {
      const consonants = text.slice(onset, nucleus.start).toLowerCase();
      const keep = consonants.length >= 2 && ONSET_CLUSTERS.has(consonants.slice(-2)) ? 2 : 1;
      onset = Math.max(onset, nucleus.start - Math.min(keep, consonants.length));
    }
    return onset;
  });
}

interface PlacedChord {
  chord: string;
  /** Character position in the line's lyric text. */
  index: number;
}

function lineToLyricAndChords(line: SongLine): { lyric: string; chords: PlacedChord[] } {
  let lyric = '';
  const chords: PlacedChord[] = [];
  for (const item of line.items) {
    if (item.type === 'chord') chords.push({ chord: item.value, index: lyric.length });
    else lyric += item.value;
  }
  return { lyric, chords };
}

function lyricAndChordsToLine(lyric: string, chords: PlacedChord[]): SongLine {
  const items: SongItem[] = [];
  let cursor = 0;
  for (const { chord, index } of [...chords].sort((a, b) => a.index - b.index)) {
    if (index > cursor) items.push({ type: 'lyric', value: lyric.slice(cursor, index) });
    items.push({ type: 'chord', value: chord });
    cursor = Math.max(cursor, index);
  }
  if (cursor < lyric.length) items.push({ type: 'lyric', value: lyric.slice(cursor) });
  return { items };
}

/** The syllable that contains a character position (a chord inside a word belongs to it). */
function syllableIndexAt(starts: number[], index: number): number {
  let count = 0;
  while (count < starts.length && starts[count] <= index) count += 1;
  return Math.max(0, count - 1);
}

/** Puts the chords of `model` on the same syllables of `target`. */
export function applyChordPattern(model: SongLine, target: SongLine): SongLine {
  const source = lineToLyricAndChords(model);
  const { lyric } = lineToLyricAndChords(target);
  const sourceStarts = syllableStarts(source.lyric);
  const targetStarts = syllableStarts(lyric);
  if (source.chords.length === 0 || targetStarts.length === 0) {
    return target;
  }

  const sourceCount = Math.max(1, sourceStarts.length);
  const placed = source.chords.map(({ chord, index }) => {
    if (index >= source.lyric.trimEnd().length) {
      // Chord after the last word (end of the line).
      return { chord, index: lyric.trimEnd().length };
    }
    const syllable = syllableIndexAt(sourceStarts, index);
    // Same syllable when both lines have the same count; proportional when
    // the count differs (elisions, approximate syllabification).
    const mapped =
      sourceStarts.length === targetStarts.length
        ? syllable
        : Math.round((syllable * targetStarts.length) / sourceCount);
    return { chord, index: targetStarts[Math.min(mapped, targetStarts.length - 1)] };
  });

  return lyricAndChordsToLine(lyric, placed);
}

const hasChords = (line: SongLine) => line.items.some((item) => item.type === 'chord');
const hasLyrics = (line: SongLine) =>
  line.items.some((item) => item.type === 'lyric' && /\p{L}/u.test(item.value));
const sectionHasChords = (section: SongSection) => section.lines.some(hasChords);
const lyricLines = (section: SongSection) => section.lines.filter(hasLyrics);
const baseType = (type: string) => type.replace(/\s*\d+$/, '');

function chooseModel(section: SongSection, chorded: SongSection[]): SongSection | undefined {
  const size = lyricLines(section).length;
  const sameType = chorded.filter((candidate) => baseType(candidate.type) === baseType(section.type));
  return (
    sameType.find((candidate) => lyricLines(candidate).length === size) ??
    sameType[0] ??
    chorded.find((candidate) => lyricLines(candidate).length === size) ??
    chorded.find((candidate) => baseType(candidate.type) === 'verse') ??
    chorded[0]
  );
}

/**
 * Sections with lyrics but no chords get the chords of the most similar
 * chorded section (same type and same number of lines first).
 */
export function fillChordsFromPattern(structure: SongStructure): SongStructure {
  const chorded = structure.sections.filter(sectionHasChords);
  if (chorded.length === 0) {
    return structure;
  }

  return {
    ...structure,
    sections: structure.sections.map((section) => {
      if (sectionHasChords(section) || lyricLines(section).length === 0) {
        return section;
      }
      const model = chooseModel(section, chorded);
      if (!model) {
        return section;
      }
      const modelLines = lyricLines(model);
      let lyricIndex = 0;
      return {
        ...section,
        lines: section.lines.map((line) => {
          if (!hasLyrics(line)) return line;
          const modelLine = modelLines[lyricIndex % modelLines.length];
          lyricIndex += 1;
          return applyChordPattern(modelLine, line);
        }),
      };
    }),
  };
}

/** True when some section has lyrics but no chords while another has chords. */
export function canFillChordsFromPattern(structure: SongStructure): boolean {
  return (
    structure.sections.some(sectionHasChords) &&
    structure.sections.some((section) => !sectionHasChords(section) && lyricLines(section).length > 0)
  );
}
