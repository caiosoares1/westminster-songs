import type { SongItem, SongSection, SongStructure } from '@/services/songs';

const CHORD_TAG_REGEX = /\[([^\]]+)\]/g;
const SECTION_LINE_REGEX = /^\[(.+)\]$/;

const SECTION_NORMALIZATION_MAP: Record<string, string> = {
  verse: 'verse',
  verso: 'verse',
  chorus: 'chorus',
  refrao: 'chorus',
  bridge: 'bridge',
  ponte: 'bridge',
  intro: 'intro',
  outro: 'outro',
  prechorus: 'prechorus',
  'pre-chorus': 'prechorus',
  'pre chorus': 'prechorus',
  'pre-refrao': 'prechorus',
  'pre refrao': 'prechorus',
};

const SECTION_DISPLAY_NAMES: Record<string, string> = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
  intro: 'Intro',
  outro: 'Outro',
  prechorus: 'Pre-Chorus',
};

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatSectionHeading(sectionType: string): string {
  const normalizedType = normalizeSectionType(sectionType);
  const mapped = SECTION_DISPLAY_NAMES[normalizedType];
  if (mapped) {
    return mapped;
  }

  return sectionType
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase()) || 'Verse';
}

export function normalizeSectionType(rawSection: string): string {
  const normalized = stripAccents(rawSection.trim().toLowerCase());
  const mappedType = SECTION_NORMALIZATION_MAP[normalized] ?? normalized;
  return mappedType || 'verse';
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

    const chordValue = match[1].trim();
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

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_LINE_REGEX);
    if (sectionMatch) {
      currentSection = { type: normalizeSectionType(sectionMatch[1]), lines: [] };
      sections.push(currentSection);
      continue;
    }

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
