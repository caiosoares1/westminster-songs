import {
  canonicalizeChord,
  isChordLine,
  isChordToken,
  normalizeChordToken,
  parseChord,
} from '@/music/chordParser';
import { syllableStarts } from '@/music/pattern';
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
  /** Line the OCR engine put this word in (used to measure the page tilt). */
  line?: number;
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
// One chord inside a run of chords read without spaces ("CD4", "DG", "A4A").
const CHORD_PIECE_REGEX = /[A-G][#b]?(?:maj7?|min|dim|aug|sus\d{0,2}|add\d{1,2}|m|\d{1,2}|[+°-])*(?:\/[A-G][#b]?)?/g;

/** "CD4" -> ["C", "D4"]; null when the token is not a run of chords. */
export function splitChordRun(token: string): string[] | null {
  const text = `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
  const pieces = text.match(CHORD_PIECE_REGEX);
  if (!pieces || pieces.length < 2 || pieces.join('') !== text) {
    return null;
  }
  return pieces.every((piece) => isChordToken(piece)) ? pieces : null;
}

export function repairOcrChordLine(line: string): string {
  if (!/\S/.test(line)) {
    return line;
  }

  const repaired = line.replace(/\S+/g, (token) => {
    if (OCR_C_MISREADS.has(token)) return 'C'.padEnd(token.length, ' ');
    if (isChordToken(token)) return token;
    return splitChordRun(token)?.join(' ') ?? token;
  });
  return repaired !== line && isChordLine(repaired) ? repaired : line;
}

function linesFromRawText(text: string): string[] {
  return text.split(/\r?\n/).map((line) => repairOcrChordLine(line.trimEnd()));
}

// "2. Texto", "3) Texto", "4 - Texto": numbered stanza.
const STANZA_NUMBER_REGEX = /^(\s*)(\d{1,2})\s*[.)\-–:]\s*(?=\p{L})/u;

/**
 * Blank lines separate stanzas, unless they are OCR noise: some engines put
 * a blank line after almost every line, and then they mean nothing.
 * Returns the lines with meaningful breaks as a single '' each.
 */
function normalizeBlankLines(lines: string[]): string[] {
  const content = lines.filter((line) => line.trim());
  let followedByBlank = 0;
  lines.forEach((line, index) => {
    if (line.trim() && index + 1 < lines.length && !lines[index + 1].trim()) followedByBlank += 1;
  });
  const blanksAreNoise = content.length > 2 && followedByBlank / content.length > 0.4;
  if (blanksAreNoise) {
    return content;
  }

  const result: string[] = [];
  for (const line of lines) {
    if (line.trim()) result.push(line);
    else if (result.length > 0 && result[result.length - 1] !== '') result.push('');
  }
  return result;
}

/** Removes the spaces left at the start of a line (stanza numbers, indentation). */
function trimLineStart(line: SongLine): SongLine {
  const items: SongItem[] = [];
  let started = false;
  for (const item of line.items) {
    if (!started && item.type === 'lyric') {
      const value = item.value.trimStart();
      if (!value) continue;
      started = true;
      items.push({ ...item, value });
      continue;
    }
    if (item.type === 'lyric') started = true;
    items.push(item);
  }
  return { items };
}

const lyricKey = (section: SongSection) =>
  section.lines
    .map((line) => line.items.filter((item) => item.type === 'lyric').map((item) => item.value).join(''))
    .join(' ')
    .toLowerCase()
    .replace(/[^\p{L}]+/gu, ' ')
    .trim();

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

/**
 * Where a chord read over the lyrics belongs: chords are printed over (often
 * centered on) a syllable, so one that lands inside a syllable moves to its
 * start, and one over a space moves to the next word.
 */
function snapToSyllable(lyric: string, syllables: number[], index: number): number {
  if (index >= lyric.trimEnd().length) {
    return Math.min(index, lyric.length);
  }
  let position = index;
  while (position < lyric.length && /\s/.test(lyric[position])) position += 1;
  if (position !== index) {
    return position;
  }
  const start = [...syllables].reverse().find((syllable) => syllable <= index);
  // Stay in the same word.
  return start !== undefined && !/\s/.test(lyric.slice(start, index)) ? start : index;
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
  const syllables = syllableStarts(lyricLine);

  for (const positionedChord of chords) {
    const start = Math.max(cursor, snapToSyllable(lyricLine, syllables, positionedChord.index));
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

function parseLinesToStructure(rawLines: string[]): SongStructure {
  const lines = normalizeBlankLines(rawLines);
  const sections: SongSection[] = [];
  let currentSection: SongSection | null = null;
  let pendingBreak = false;

  const startStanza = (number: string | null) => {
    const verses = sections.filter((section) => section.type.startsWith('verse')).length;
    const type = number ? `verse ${number}` : verses === 0 ? 'verse' : `verse ${verses + 1}`;
    currentSection = { type, lines: [] };
    sections.push(currentSection);
    return currentSection;
  };

  // Takes "2." off a lyric line, keeping the columns (chords above stay aligned).
  const takeStanzaNumber = (line: string | undefined): { line: string | undefined; number: string | null } => {
    const match = line?.match(STANZA_NUMBER_REGEX);
    if (!line || !match || isChordLine(line.trim())) return { line, number: null };
    return { line: match[1] + ' '.repeat(match[0].length - match[1].length) + line.slice(match[0].length), number: match[2] };
  };

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      pendingBreak = true;
      index += 1;
      continue;
    }

    if (isSectionHeaderLine(trimmed)) {
      currentSection = { type: normalizeSectionType(trimmed), lines: [] };
      sections.push(currentSection);
      pendingBreak = false;
      index += 1;
      continue;
    }

    const chordLine = isChordLine(trimmed);
    const own = takeStanzaNumber(line);
    const next = chordLine ? takeStanzaNumber(lines[index + 1]) : { line: lines[index + 1], number: null };
    const number = own.number ?? next.number;

    // New stanza: after a blank line or at a "2." marker, once the current
    // section already has content.
    const current = currentSection as SongSection | null;
    let section: SongSection;
    if (!current || ((pendingBreak || number) && current.lines.length > 0)) {
      section = startStanza(number);
    } else {
      section = current;
    }
    pendingBreak = false;

    const lineText = own.line ?? line;

    if (trimmed.includes('[') && trimmed.includes(']')) {
      section.lines.push({ items: parseLineToItems(lineText) });
      index += 1;
      continue;
    }

    if (chordLine) {
      const nextLine = next.line;
      const hasLyricPair =
        typeof nextLine === 'string' &&
        nextLine.trim().length > 0 &&
        !isSectionHeaderLine(nextLine) &&
        !isChordLine(nextLine);

      if (hasLyricPair) {
        section.lines.push(trimLineStart(buildLineFromChordAndLyric(line, nextLine)));
        index += 2;
        continue;
      }

      section.lines.push(buildChordOnlyLine(line));
      index += 1;
      continue;
    }

    section.lines.push(trimLineStart({ items: [{ type: 'lyric', value: lineText }] }));
    index += 1;
  }

  const filled = sections.filter((section) => section.lines.length > 0);
  if (filled.length === 0) {
    throw new Error('Nenhuma linha reconhecida no OCR.');
  }

  // A stanza with the same words as the chorus is the chorus repeated.
  const choruses = filled.filter((section) => section.type.startsWith('chorus')).map(lyricKey);
  return {
    sections: filled.map((section) =>
      section.type.startsWith('verse') && choruses.includes(lyricKey(section))
        ? { ...section, type: 'chorus' }
        : section,
    ),
  };
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

/**
 * Slope of the text lines (dy/dx) in a tilted photo, measured on the lines
 * the OCR engine recognized with several words. 0 when unknown.
 */
export function estimateTilt(tokens: OcrToken[]): number {
  const byLine = new Map<number, OcrToken[]>();
  for (const token of tokens) {
    if (token.line === undefined) continue;
    byLine.set(token.line, [...(byLine.get(token.line) ?? []), token]);
  }

  const slopes: number[] = [];
  for (const lineTokens of byLine.values()) {
    if (lineTokens.length < 2) continue;
    const points = lineTokens.map((token) => ({
      x: token.x + token.width / 2,
      y: token.y + token.height / 2,
    }));
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const sxx = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    // Words close together say little about the angle.
    if (sxx === 0 || Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) < 100) {
      continue;
    }
    const sxy = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
    slopes.push(sxy / sxx);
  }

  const slope = median(slopes);
  // Ignore implausible angles (more than ~15 degrees).
  return Math.abs(slope) <= 0.27 ? slope : 0;
}

/** Straightens a tilted photo: rotates the word positions so lines are horizontal. */
function deskewTokens(tokens: OcrToken[]): OcrToken[] {
  const slope = estimateTilt(tokens);
  if (slope === 0) {
    return tokens;
  }
  const cos = 1 / Math.sqrt(1 + slope * slope);
  const sin = slope * cos;
  return tokens.map((token) => {
    const centerX = token.x + token.width / 2;
    const centerY = token.y + token.height / 2;
    const x = centerX * cos + centerY * sin;
    const y = centerY * cos - centerX * sin;
    return { ...token, x: x - token.width / 2, y: y - token.height / 2 };
  });
}

/** Rebuilds the page as text lines, keeping horizontal positions as spaces. */
export function tokensToTextLines(tokens: OcrToken[]): string[] {
  const usable = deskewTokens(tokens.filter((token) => token.text.trim() && token.width > 0));
  if (usable.length === 0) {
    return [];
  }

  const grid = buildColumnGrid(usable);
  const groups = groupTokensByLine(usable);
  const tops = groups.map((group) => Math.min(...group.map((token) => token.y)));
  const bottoms = groups.map((group) => Math.max(...group.map((token) => token.y + token.height)));
  const gaps = groups.slice(1).map((_, index) => tops[index + 1] - bottoms[index]);
  const lineHeight = median(usable.map((token) => token.height));
  // A blank line between stanzas leaves a gap of about one line height;
  // lines inside a stanza are much closer.
  const breakGap = Math.max(lineHeight * 0.9, median(gaps) * 2);

  const lines: string[] = [];
  groups.forEach((group, index) => {
    if (index > 0 && gaps[index - 1] > breakGap) lines.push('');
    const line = repairOcrChordLine(tokensToLine(group, grid));
    if (line.trim()) lines.push(line);
  });
  return lines;
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
