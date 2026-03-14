const CHORD_HEAD_REGEX = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;
const CHORD_SUFFIX_REGEX =
  /^(?:(?:maj|min|dim|aug|sus|add|m|M)|(?:\d{1,2})|(?:[#b]\d{1,2})|(?:\([#b0-9,+-]+\))|(?:\+))*$/;
const TOKEN_EDGE_PUNCTUATION = /^[\[\](){}"'.,;:!?|]+|[\[\](){}"'.,;:!?|]+$/g;
const NEUTRAL_LINE_TOKENS = new Set(['|', '||', '/', '-', '--', '---']);

export interface ParsedChord {
  root: string;
  suffix: string;
  bass: string | null;
}

export function parseChord(chord: string): ParsedChord | null {
  const trimmedChord = chord.trim();
  if (!trimmedChord) {
    return null;
  }

  const canonicalChord = `${trimmedChord[0].toUpperCase()}${trimmedChord.slice(1)}`;
  const match = canonicalChord.match(CHORD_HEAD_REGEX);
  if (!match) {
    return null;
  }

  const [, root, suffix = '', bass] = match;
  if (!CHORD_SUFFIX_REGEX.test(suffix)) {
    return null;
  }

  return {
    root,
    suffix,
    bass: bass ?? null,
  };
}

export function normalizeChordToken(token: string): string {
  return token
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(TOKEN_EDGE_PUNCTUATION, '');
}

export function isChordToken(token: string): boolean {
  const normalizedToken = normalizeChordToken(token);
  if (!normalizedToken) {
    return false;
  }

  return parseChord(normalizedToken) !== null;
}

export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }

  let chordCount = 0;
  let wordCount = 0;

  for (const token of tokens) {
    if (NEUTRAL_LINE_TOKENS.has(token)) {
      continue;
    }

    if (isChordToken(token)) {
      chordCount += 1;
    } else {
      wordCount += 1;
    }
  }

  if (chordCount === 0) {
    return false;
  }

  if (wordCount === 0) {
    return true;
  }

  return chordCount >= wordCount + 1;
}
