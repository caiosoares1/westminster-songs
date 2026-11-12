import type { SongLine, SongSection, SongStructure } from '@/services/songs';

const isPlainVerse = (type: string) => /^verse(\s+\d+)?$/.test(type);

/**
 * Joins the chord sheets read from several photos of the same song, in
 * order. A photo that starts without a title or stanza number continues
 * the last section of the previous photo (the sheet was cut mid-stanza).
 * Untitled stanzas are renumbered across photos (Verso, Verso 2, ...).
 */
const lineKey = (line: SongLine) => {
  const lyric = line.items
    .filter((item) => item.type === 'lyric')
    .map((item) => item.value)
    .join('')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
  const chords = line.items.filter((item) => item.type === 'chord').map((item) => item.value);
  return lyric || `#${chords.join(' ')}`;
};

const chordCount = (line: SongLine) => line.items.filter((item) => item.type === 'chord').length;

/** Edit distance, for lines read twice with small OCR differences. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

const sameLine = (a: SongLine, b: SongLine) => {
  const keyA = lineKey(a);
  const keyB = lineKey(b);
  if (keyA.length < 4 || keyB.length < 4) return keyA === keyB && keyA.length > 0;
  return distance(keyA, keyB) <= Math.max(keyA.length, keyB.length) * 0.15;
};

/**
 * Lines at the end of one photo that appear again at the start of the next
 * (the photos overlap): how many, up to 6.
 */
function overlapLength(previous: SongLine[], next: SongLine[]): number {
  for (let size = Math.min(6, previous.length, next.length); size > 0; size -= 1) {
    const tail = previous.slice(previous.length - size);
    if (!tail.every((line, index) => sameLine(line, next[index]))) continue;
    // A single short line ("Aleluia!") may just repeat on purpose.
    if (size === 1 && lineKey(tail[0]).length < 12) return 0;
    return size;
  }
  return 0;
}

export function combineStructures(
  parts: SongStructure[],
  continuesPrevious: boolean[] = [],
): SongStructure {
  let startsWithoutTitle = continuesPrevious;
  const sections: SongSection[] = [];

  parts.forEach((part, partIndex) => {
    let partSections = part.sections;
    const last = sections[sections.length - 1];
    const first = partSections[0];
    if (partIndex > 0 && last && first) {
      // Drop what the photos repeat; keep the copy read with more chords.
      const size = overlapLength(last.lines, first.lines);
      if (size > 0) {
        const start = last.lines.length - size;
        const merged = last.lines.map((line, index) => {
          const other = index >= start ? first.lines[index - start] : undefined;
          return other && chordCount(other) > chordCount(line) ? other : line;
        });
        sections[sections.length - 1] = { ...last, lines: merged };
        const rest = first.lines.slice(size);
        partSections = rest.length > 0 ? [{ ...first, lines: rest }, ...partSections.slice(1)] : partSections.slice(1);
        // What is left of that stanza continues the previous photo; if
        // nothing is left, the next stanza starts fresh.
        const continues = rest.length > 0;
        startsWithoutTitle = parts.map((_, index) =>
          index === partIndex ? continues : (startsWithoutTitle[index] ?? false),
        );
      }
    }

    partSections.forEach((section, sectionIndex) => {
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

  return renumberVerses({ sections });
}

/** Numbers the untitled stanzas in order: Verso, Verso 2, Verso 3... */
export function renumberVerses(structure: SongStructure): SongStructure {
  let verseNumber = 0;
  return {
    ...structure,
    sections: structure.sections.map((section) => {
      if (!isPlainVerse(section.type)) return section;
      verseNumber += 1;
      return { ...section, type: verseNumber === 1 ? 'verse' : `verse ${verseNumber}` };
    }),
  };
}
