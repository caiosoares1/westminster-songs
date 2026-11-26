import { renumberVerses } from '@/music/combine';
import type { SongLine, SongStructure } from '@/services/songs';

/** Heading of a hymnal page: "120 DEPENDÊNCIA. G 3/4", or a title alone ("SALMO 11"). */
export interface HymnHeader {
  /** Hymnal number; absent when the page has only a title. */
  number?: string;
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

// Credit lines under the title: "Letra: ...", "Música: ...", "Letra e música: ...".
const CREDIT_REGEX =
  /^(?:letra|m[úu]sica|melodia|autor(?:es|a)?|tradu[çc][ãa]o|vers[ãa]o|arranjo|arr|composi[çc][ãa]o|harmoniza[çc][ãa]o|texto|fonte|cifra)(?:\s+e\s+m[úu]sica)?\s*\.?\s*:/iu;

export function isCreditLine(text: string): boolean {
  return CREDIT_REGEX.test(text.trim());
}

// A title alone, in capitals, maybe with a number: "SALMO 11", "CASTELO FORTE".
const TITLE_REGEX = /^[\p{L}][\p{L}'’\-,!? ]*?[\p{L}!?](?:\s+\d{1,3}[A-Za-z]?)?\.?$/u;

/** Reads a title printed alone ("SALMO 11"); it must be in capitals. */
export function parseTitleHeader(text: string): HymnHeader | null {
  const trimmed = text.trim();
  if (!TITLE_REGEX.test(trimmed) || trimmed.split(/\s+/).length > 6) {
    return null;
  }
  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  const capitals = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (letters.length < 3 || capitals / letters.length < 0.8) {
    return null;
  }
  return { title: toTitleCase(trimmed.replace(/[.,]+$/, '')) };
}

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
 * on the same page). A title printed alone ("SALMO 11", set apart from the
 * first stanza) also counts, and credit lines ("Letra: ...") go too.
 */
export function extractHymnHeader(structure: SongStructure): {
  structure: SongStructure;
  header: HymnHeader | null;
} {
  // Credit lines among the first lines of the sheet.
  let sections = structure.sections.map((section, sectionIndex) =>
    sectionIndex > 1
      ? section
      : {
          ...section,
          lines: section.lines.filter(
            (line, lineIndex) => lineIndex >= 4 || hasChords(line) || !isCreditLine(lineText(line)),
          ),
        },
  );
  const creditsRemoved = sections.some((section, index) => section.lines.length !== structure.sections[index].lines.length);

  let header: HymnHeader | null = null;
  search: for (const [sectionIndex, section] of sections.slice(0, 2).entries()) {
    for (const [lineIndex, line] of section.lines.slice(0, 3).entries()) {
      if (hasChords(line)) continue;
      const found = parseHymnHeader(lineText(line));
      if (!found) continue;
      header = found;
      const rest = section.lines.slice(lineIndex + 1);
      sections = [...(rest.length > 0 ? [{ ...section, lines: rest }] : []), ...sections.slice(sectionIndex + 1)];
      break search;
    }
  }

  // Title alone: the first section is just that line.
  const first = sections[0];
  if (!header && first?.lines.length === 1 && sections.length > 1 && !hasChords(first.lines[0])) {
    header = parseTitleHeader(lineText(first.lines[0]));
    if (header) sections = sections.slice(1);
  }

  if (!header && !creditsRemoved) {
    return { structure, header: null };
  }
  const filled = sections.filter((section) => section.lines.length > 0);
  return { structure: renumberVerses({ ...structure, sections: filled }), header };
}
