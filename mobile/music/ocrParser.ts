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

function linesFromRawText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
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

function tokensToLine(tokens: OcrToken[]): string {
  if (tokens.length === 0) {
    return '';
  }

  const sortedTokens = [...tokens].sort((a, b) => a.x - b.x);
  let line = '';
  let cursorX = sortedTokens[0].x;

  for (const token of sortedTokens) {
    const safeText = token.text.trim();
    if (!safeText) {
      continue;
    }

    const averageCharWidth = token.width / Math.max(1, safeText.length);
    const gap = token.x - cursorX;

    if (line.length > 0) {
      const spaces = gap > averageCharWidth * 1.5 ? Math.round(gap / Math.max(averageCharWidth, 1)) : 1;
      line += ' '.repeat(Math.max(1, Math.min(spaces, 12)));
    }

    line += safeText;
    cursorX = token.x + token.width;
  }

  return line.trimEnd();
}

export function groupTokensByLine(tokens: OcrToken[], tolerance = 14): OcrToken[][] {
  const sortedTokens = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: OcrToken[][] = [];
  let currentGroup: OcrToken[] = [];
  let currentY: number | null = null;

  for (const token of sortedTokens) {
    const tokenCenterY = token.y + token.height / 2;

    if (currentY === null || Math.abs(tokenCenterY - currentY) <= tolerance) {
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

export function parseOcrTextToStructure(text: string): SongStructure {
  const lines = linesFromRawText(text);
  if (lines.length === 0) {
    throw new Error('Texto OCR vazio.');
  }

  return parseLinesToStructure(lines);
}

export function parseOcrTokensToStructure(tokens: OcrToken[]): SongStructure {
  if (tokens.length === 0) {
    throw new Error('Tokens OCR vazios.');
  }

  const lines = groupTokensByLine(tokens)
    .map(tokensToLine)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error('Nenhuma linha reconhecida a partir dos tokens OCR.');
  }

  return parseLinesToStructure(lines);
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
