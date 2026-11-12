import { renumberVerses } from '@/music/combine';
import type { SongLine, SongStructure } from '@/services/songs';

/** Heading of a hymnal page: "120 DEPENDÊNCIA. G 3/4". */
export interface HymnHeader {
  number: string;
  /** Title in normal case: "Dependência". */
  title: string;
  key?: string;
  timeSignature?: string;
}

const HEADER_REGEX =
  /^(\d{1,4}[A-Za-z]?)\s*[.\-–]?\s+([\p{L}][\p{L}'’\-,!? ]*?[\p{L}!?])\.?(?:\s+([A-G][#b]?m?))?(?:\s+(\d{1,2}\s*\/?\s*[248]))?\s*$/u;

// Short words written in lower case inside a title.
const LOWER_WORDS = new Set([
  'a', 'à', 'ao', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'pela', 'pelo', 'por',
]);

function toTitleCase(text: string): string {
  return text
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && LOWER_WORDS.has(word) ? word : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1),
    )
    .join(' ');
}

const lineText = (line: SongLine) =>
  line.items
    .filter((item) => item.type === 'lyric')
    .map((item) => item.value)
    .join('')
    .trim();

const hasChords = (line: SongLine) => line.items.some((item) => item.type === 'chord');

/** "3/4"; OCR often loses the slash ("34", "68", "128"). */
function formatTimeSignature(raw: string): string {
  const digits = raw.replace(/\s+/g, '');
  if (digits.includes('/')) return digits;
  return `${digits.slice(0, -1)}/${digits.slice(-1)}`;
}

/** Reads a heading line ("120 DEPENDÊNCIA. G 3/4"); the title must be in capitals. */
export function parseHymnHeader(text: string): HymnHeader | null {
  const match = text.trim().match(HEADER_REGEX);
  if (!match) {
    return null;
  }
  const [, number, rawTitle, key, timeSignature] = match;
  const letters = rawTitle.replace(/[^\p{L}]/gu, '');
  const capitals = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (letters.length < 3 || capitals / letters.length < 0.8) {
    return null;
  }
  return {
    number,
    title: toTitleCase(rawTitle.replace(/[.,]+$/, '')),
    ...(key ? { key } : {}),
    ...(timeSignature ? { timeSignature: formatTimeSignature(timeSignature) } : {}),
  };
}

/**
 * Finds the hymn heading in the first lines of the sheet and takes it out
 * of the lyrics, with whatever came before it (the end of the previous hymn
 * on the same page).
 */
export function extractHymnHeader(structure: SongStructure): {
  structure: SongStructure;
  header: HymnHeader | null;
} {
  for (const [sectionIndex, section] of structure.sections.slice(0, 2).entries()) {
    for (const [lineIndex, line] of section.lines.slice(0, 3).entries()) {
      if (hasChords(line)) continue;
      const header = parseHymnHeader(lineText(line));
      if (!header) continue;
      const rest = section.lines.slice(lineIndex + 1);
      const sections = [
        ...(rest.length > 0 ? [{ ...section, lines: rest }] : []),
        ...structure.sections.slice(sectionIndex + 1),
      ];
      return { structure: renumberVerses({ ...structure, sections }), header };
    }
  }
  return { structure, header: null };
}
