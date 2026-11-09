import { canonicalizeChord, isChordToken } from '@/music/chordParser';
import type { SongItem, SongSection, SongStructure } from '@/services/songs';

const CHORD_TAG_REGEX = /\[([^\]]+)\]/g;
// A single bracket pair holding the whole line, e.g. "[Refrão]" (not "[C] [G]").
const SECTION_LINE_REGEX = /^\[([^[\]]+)\]$/;

// Section names (accents stripped, lower-case) -> canonical type.
const SECTION_NORMALIZATION_MAP: Record<string, string> = {
  verse: 'verse',
  verso: 'verse',
  estrofe: 'verse',
  chorus: 'chorus',
  refrao: 'chorus',
  coro: 'chorus',
  bridge: 'bridge',
  ponte: 'bridge',
  intro: 'intro',
  introducao: 'intro',
  outro: 'outro',
  final: 'outro',
  finalizacao: 'outro',
  prechorus: 'prechorus',
  'pre-chorus': 'prechorus',
  'pre chorus': 'prechorus',
  'pre-refrao': 'prechorus',
  'pre refrao': 'prechorus',
  prerefrao: 'prechorus',
  interlude: 'interlude',
  interludio: 'interlude',
  solo: 'solo',
  tag: 'tag',
};

const SECTION_DISPLAY_NAMES: Record<string, string> = {
  verse: 'Verso',
  chorus: 'Refrão',
  bridge: 'Ponte',
  intro: 'Introdução',
  outro: 'Final',
  prechorus: 'Pré-refrão',
  interlude: 'Interlúdio',
  solo: 'Solo',
  tag: 'Tag',
};

const SECTION_WITH_NUMBER_REGEX = /^(.*?)(?:\s*(\d+))?$/;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function splitSectionName(rawSection: string): { name: string; number: string | null } {
  const cleaned = stripAccents(rawSection.trim().toLowerCase())
    .replace(/:$/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const match = cleaned.match(SECTION_WITH_NUMBER_REGEX);
  return { name: (match?.[1] ?? cleaned).trim(), number: match?.[2] ?? null };
}

/**
 * Canonical section type, keeping the number: "Verso 2" -> "verse 2",
 * "[Refrão]" -> "chorus". Unknown names are kept (lower-case, no accents).
 */
export function normalizeSectionType(rawSection: string): string {
  const { name, number } = splitSectionName(rawSection);
  const mappedType = SECTION_NORMALIZATION_MAP[name] ?? name;
  if (!mappedType) {
    return 'verse';
  }
  return number ? `${mappedType} ${number}` : mappedType;
}

/** True when the text names a known section, e.g. "Refrão", "[Verso 2]:". */
export function isKnownSectionHeading(text: string): boolean {
  const { name } = splitSectionName(text);
  return name in SECTION_NORMALIZATION_MAP;
}

/** Human label for a stored section type: "verse 2" -> "Verso 2". */
export function formatSectionHeading(sectionType: string): string {
  const { name, number } = splitSectionName(sectionType);
  const canonical = SECTION_NORMALIZATION_MAP[name] ?? name;
  const label =
    SECTION_DISPLAY_NAMES[canonical] ??
    (sectionType
      .trim()
      .replace(/\s*\d+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\w/, (character) => character.toUpperCase()) || 'Verso');
  return number ? `${label} ${number}` : label;
}

export function parseLineToItems(line: string): SongItem[] {
  const matches = [...line.matchAll(CHORD_TAG_REGEX)];

  if (matches.length === 0) {
    return [{ type: 'lyric', value: line }];
  }

  const items: SongItem[] = [];
  let cursor = 0;

  for (const match of matches) {
    const index = match.index ?? 0;
    const lyricChunk = line.slice(cursor, index);
    if (lyricChunk) {
      items.push({ type: 'lyric', value: lyricChunk });
    }

    const chordValue = canonicalizeChord(match[1].trim());
    if (chordValue) {
      items.push({ type: 'chord', value: chordValue });
    }

    cursor = index + match[0].length;
  }

  const trailingLyric = line.slice(cursor);
  if (trailingLyric) {
    items.push({ type: 'lyric', value: trailingLyric });
  }

  return items.length > 0 ? items : [{ type: 'lyric', value: line }];
}

export function lineToBracketText(items: SongItem[]): string {
  return items.map((item) => (item.type === 'chord' ? `[${item.value}]` : item.value)).join('');
}

export function parseBracketContentToStructure(content: string): SongStructure {
  const sections: SongSection[] = [];
  let currentSection: SongSection | null = null;

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { type: 'verse', lines: [] };
      sections.push(currentSection);
    }

    return currentSection;
  };

  let pendingBreak = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      pendingBreak = true;
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_LINE_REGEX);
    // "[G]" alone is a chord-only line, not a section called "g".
    if (sectionMatch && !isChordToken(sectionMatch[1])) {
      currentSection = { type: normalizeSectionType(sectionMatch[1]), lines: [] };
      sections.push(currentSection);
      pendingBreak = false;
      continue;
    }

    // A blank line between blocks of lyrics without a title starts a new
    // stanza ("Verso 2", "Verso 3"...).
    const current = currentSection as SongSection | null;
    if (pendingBreak && current && current.lines.length > 0) {
      const verses = sections.filter((section) => section.type.startsWith('verse')).length;
      currentSection = { type: verses === 0 ? 'verse' : `verse ${verses + 1}`, lines: [] };
      sections.push(currentSection);
    }
    pendingBreak = false;

    const section = ensureSection();
    section.lines.push({ items: parseLineToItems(line) });
  }

  const hasAnyLine = sections.some((section) => section.lines.length > 0);
  if (!hasAnyLine) {
    throw new Error('Conteudo vazio.');
  }

  return { sections };
}

export function structureToBracketContent(structureJson: SongStructure): string {
  const lines: string[] = [];

  for (const section of structureJson.sections) {
    lines.push(`[${formatSectionHeading(section.type)}]`);

    for (const line of section.lines) {
      lines.push(lineToBracketText(line.items));
    }

    lines.push('');
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/** Runtime check for data coming from the API (older rows may be malformed). */
export function isSongStructure(value: unknown): value is SongStructure {
  if (!value || typeof value !== 'object') return false;
  const { sections } = value as { sections?: unknown };
  return (
    Array.isArray(sections) &&
    sections.every(
      (section) =>
        section &&
        typeof section.type === 'string' &&
        Array.isArray(section.lines) &&
        section.lines.every(
          (line: { items?: unknown }) =>
            line &&
            Array.isArray(line.items) &&
            line.items.every(
              (item: { type?: unknown; value?: unknown }) =>
                item &&
                (item.type === 'chord' || item.type === 'lyric') &&
                typeof item.value === 'string',
            ),
        ),
    )
  );
}
