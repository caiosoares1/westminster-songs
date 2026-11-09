import {
  canonicalizeChord,
  isChordLine,
  isChordToken,
  normalizeChordToken,
  parseChord,
} from '@/music/chordParser';
import type { SongItem, SongLine, SongSection, SongStructure } from '@/services/songs';
import {
  isKnownSectionHeading,
  normalizeSectionType,
  parseLineToItems,
} from '@/utils/song-structure';

export interface OcrToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PositionedChord {
  chord: string;
  index: number;
}

// How OCR engines tend to misread a lone "C" chord.
const OCR_C_MISREADS = new Set(['Cc', 'cC', 'CC', '€', '{', '(', '©', '¢']);

/**
 * Fixes known misreads of a chord, keeping column positions, but only when
 * the result is a chord line (so lyrics are never touched).
 */
export function repairOcrChordLine(line: string): string {
  if (!/\S/.test(line)) {
    return line;
  }

  const repaired = line.replace(/\S+/g, (token) =>
    OCR_C_MISREADS.has(token) ? 'C'.padEnd(token.length, ' ') : token,
  );
  return repaired !== line && isChordLine(repaired) ? repaired : line;
}

function linesFromRawText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => repairOcrChordLine(line.trimEnd()))
    .filter((line) => line.trim().length > 0);
}

function isSectionHeaderLine(line: string): boolean {
  return isKnownSectionHeading(line);
}

function extractPositionedChords(chordLine: string): PositionedChord[] {
  const matches = chordLine.matchAll(/\S+/g);
  const chords: PositionedChord[] = [];

  for (const match of matches) {
    const rawToken = match[0] ?? '';
    const normalized = normalizeChordToken(rawToken);
    if (!normalized || !isChordToken(normalized)) {
      continue;
    }

    chords.push({
      chord: canonicalizeChord(normalized),
      index: match.index ?? 0,
    });
  }

  return chords;
}

function buildChordOnlyLine(chordLine: string): SongLine {
  const chords = extractPositionedChords(chordLine);
  if (chords.length === 0) {
    return { items: [{ type: 'lyric', value: chordLine }] };
  }

  const items: SongItem[] = [];

  chords.forEach((chord, index) => {
    items.push({ type: 'chord', value: chord.chord });
    if (index < chords.length - 1) {
      items.push({ type: 'lyric', value: ' ' });
    }
  });

  return { items };
}

function buildLineFromChordAndLyric(chordLine: string, lyricLine: string): SongLine {
  const chords = extractPositionedChords(chordLine);
  if (chords.length === 0) {
    return { items: [{ type: 'lyric', value: lyricLine }] };
  }

  if (!lyricLine.trim()) {
    return buildChordOnlyLine(chordLine);
  }

  const items: SongItem[] = [];
  let cursor = 0;

  for (const positionedChord of chords) {
    const start = Math.max(cursor, Math.min(positionedChord.index, lyricLine.length));
    const lyricChunk = lyricLine.slice(cursor, start);

    if (lyricChunk) {
      items.push({ type: 'lyric', value: lyricChunk });
    }

    items.push({ type: 'chord', value: positionedChord.chord });
    cursor = start;
  }

  const trailing = lyricLine.slice(cursor);
  if (trailing) {
    items.push({ type: 'lyric', value: trailing });
  }

  return items.length > 0 ? { items } : { items: [{ type: 'lyric', value: lyricLine }] };
}

function parseLinesToStructure(lines: string[]): SongStructure {
  const sections: SongSection[] = [];
  let currentSection: SongSection | null = null;

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { type: 'verse', lines: [] };
      sections.push(currentSection);
    }

    return currentSection;
  };

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (isSectionHeaderLine(trimmed)) {
      currentSection = { type: normalizeSectionType(trimmed), lines: [] };
      sections.push(currentSection);
      index += 1;
      continue;
    }

    const section = ensureSection();

    if (trimmed.includes('[') && trimmed.includes(']')) {
      section.lines.push({ items: parseLineToItems(line) });
      index += 1;
      continue;
    }

    if (isChordLine(trimmed)) {
      const nextLine = lines[index + 1];
      const hasLyricPair =
        typeof nextLine === 'string' &&
        nextLine.trim().length > 0 &&
        !isSectionHeaderLine(nextLine) &&
        !isChordLine(nextLine);

      if (hasLyricPair) {
        section.lines.push(buildLineFromChordAndLyric(line, nextLine));
        index += 2;
        continue;
      }

      section.lines.push(buildChordOnlyLine(line));
      index += 1;
      continue;
    }

    section.lines.push({ items: [{ type: 'lyric', value: line }] });
    index += 1;
  }

  const hasAnyLine = sections.some((section) => section.lines.length > 0);
  if (!hasAnyLine) {
    throw new Error('Nenhuma linha reconhecida no OCR.');
  }

  return { sections };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

interface ColumnGrid {
  left: number;
  charWidth: number;
}

/**
 * One column grid for the whole page, so a chord line keeps its horizontal
 * offset relative to the lyric line below it (each line laid out from its
 * own first word would lose that alignment).
 */
function buildColumnGrid(tokens: OcrToken[]): ColumnGrid {
  const left = Math.min(...tokens.map((token) => token.x));
  // Character width estimated from longer words (lyrics); chords are short
  // and their width per character is less reliable.
  const widths = tokens
    .filter((token) => token.text.trim().length >= 3)
    .map((token) => token.width / token.text.trim().length);
  const fallback = tokens.map((token) => token.width / Math.max(1, token.text.trim().length));
  return { left, charWidth: Math.max(1, median(widths.length > 0 ? widths : fallback)) };
}

function tokensToLine(tokens: OcrToken[], grid: ColumnGrid): string {
  let line = '';

  for (const token of [...tokens].sort((a, b) => a.x - b.x)) {
    const text = token.text.trim();
    if (!text) {
      continue;
    }

    const column = Math.round((token.x - grid.left) / grid.charWidth);
    // At least one space between words, even if the estimate overlaps.
    const minimumColumn = line.length === 0 ? 0 : line.length + 1;
    line = line.padEnd(Math.max(column, minimumColumn), ' ') + text;
  }

  return line.trimEnd();
}

/** Groups words into lines by vertical position (tolerance scales with text size). */
export function groupTokensByLine(tokens: OcrToken[], tolerance?: number): OcrToken[][] {
  const lineTolerance = tolerance ?? Math.max(4, median(tokens.map((token) => token.height)) * 0.5);
  const sortedTokens = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: OcrToken[][] = [];
  let currentGroup: OcrToken[] = [];
  let currentY: number | null = null;

  for (const token of sortedTokens) {
    const tokenCenterY = token.y + token.height / 2;

    if (currentY === null || Math.abs(tokenCenterY - currentY) <= lineTolerance) {
      currentGroup.push(token);
      currentY = currentY === null ? tokenCenterY : (currentY + tokenCenterY) / 2;
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [token];
    currentY = tokenCenterY;
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups.map((group) => group.sort((a, b) => a.x - b.x));
}

/** Rebuilds the page as text lines, keeping horizontal positions as spaces. */
export function tokensToTextLines(tokens: OcrToken[]): string[] {
  const usable = tokens.filter((token) => token.text.trim() && token.width > 0);
  if (usable.length === 0) {
    return [];
  }

  const grid = buildColumnGrid(usable);
  return groupTokensByLine(usable)
    .map((group) => repairOcrChordLine(tokensToLine(group, grid)))
    .filter((line) => line.trim().length > 0);
}

export function parseOcrTextToStructure(text: string): SongStructure {
  const lines = linesFromRawText(text);
  if (lines.length === 0) {
    throw new Error('Texto OCR vazio.');
  }

  return parseLinesToStructure(lines);
}

export function parseOcrTokensToStructure(tokens: OcrToken[]): SongStructure {
  const lines = tokensToTextLines(tokens);
  if (lines.length === 0) {
    throw new Error('Nenhuma linha reconhecida a partir dos tokens OCR.');
  }

  // Columns are kept exact to place the chords; once placed, the extra
  // spaces that rounding left inside the lyrics are no longer needed.
  const structure = parseLinesToStructure(lines);
  return {
    ...structure,
    sections: structure.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        items: line.items.map((item) =>
          item.type === 'lyric' ? { ...item, value: item.value.replace(/ {2,}/g, ' ') } : item,
        ),
      })),
    })),
  };
}

export function extractLikelyOriginalKey(structureJson: SongStructure): string | null {
  for (const section of structureJson.sections) {
    for (const line of section.lines) {
      for (const item of line.items) {
        if (item.type !== 'chord') {
          continue;
        }

        const parsed = parseChord(item.value);
        if (!parsed) {
          continue;
        }

        const isMinor = parsed.suffix.startsWith('m') && !parsed.suffix.startsWith('maj');
        return isMinor ? `${parsed.root}m` : parsed.root;
      }
    }
  }

  return null;
}
