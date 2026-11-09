import type { SongSection, SongStructure } from '@/services/songs';

const isPlainVerse = (type: string) => /^verse(\s+\d+)?$/.test(type);

/**
 * Joins the chord sheets read from several photos of the same song, in
 * order. A photo that starts without a title or stanza number continues
 * the last section of the previous photo (the sheet was cut mid-stanza).
 * Untitled stanzas are renumbered across photos (Verso, Verso 2, ...).
 */
export function combineStructures(
  parts: SongStructure[],
  startsWithoutTitle: boolean[] = [],
): SongStructure {
  const sections: SongSection[] = [];

  parts.forEach((part, partIndex) => {
    part.sections.forEach((section, sectionIndex) => {
      const previous = sections[sections.length - 1];
      const continues =
        partIndex > 0 && sectionIndex === 0 && startsWithoutTitle[partIndex] && previous !== undefined;
      if (continues) {
        sections[sections.length - 1] = { ...previous, lines: [...previous.lines, ...section.lines] };
      } else {
        sections.push({ ...section, lines: [...section.lines] });
      }
    });
  });

  let verseNumber = 0;
  return {
    sections: sections.map((section) => {
      if (!isPlainVerse(section.type)) return section;
      verseNumber += 1;
      return { ...section, type: verseNumber === 1 ? 'verse' : `verse ${verseNumber}` };
    }),
  };
}
