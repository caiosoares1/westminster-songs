// Root, suffix and optional bass. The suffix may contain "/<digits>" so that
// Brazilian notation such as E7/9 or C6/9 is a suffix, not a bass note.
const CHORD_HEAD_REGEX = /^([A-G](?:#|b)?)((?:[^/\s]|\/(?=\d))*)(?:\/([A-G](?:#|b)?))?$/;
const CHORD_SUFFIX_REGEX =
  /^(?:(?:maj|min|dim|aug|sus|add|m|M)|(?:\d{1,2})|(?:[#b+-]\d{1,2})|(?:\((?:add|sus|maj|M|[#b0-9,+\-/])+\))|(?:\/\d{1,2})|(?:[+°ºø]))*$/;
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

/** Rewrites a chord with an upper-case root (OCR often reads "C" as "c"). */
export function canonicalizeChord(chord: string): string {
  const parsed = parseChord(chord);
  if (!parsed) {
    return chord;
  }

  return `${parsed.root}${parsed.suffix}${parsed.bass ? `/${parsed.bass}` : ''}`;
}

export function normalizeChordToken(token: string): string {
  return token
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/º/g, '°')
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

const SOLFEGE_TO_LETTER: Record<string, string> = {
  do: 'C',
  re: 'D',
  mi: 'E',
  fa: 'F',
  sol: 'G',
  la: 'A',
  si: 'B',
};

/**
 * Normalizes what a user types as a song key into the API format
 * ("C", "F#", "Bb", "Am"). Accepts chords ("am7" -> "Am") and solfège
 * ("Dó", "Ré menor", "Fá#m"). Returns null when it can't be understood.
 */
export function normalizeKey(input: string): string | null {
  let value = input
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
  if (!value) {
    return null;
  }

  const solfege = value.toLowerCase().match(/^(do|re|mi|fa|sol|la|si)\s*(#|b)?\s*(m|menor|maior)?$/);
  if (solfege) {
    const [, name, accidental = '', quality = ''] = solfege;
    value = `${SOLFEGE_TO_LETTER[name]}${accidental}${quality === 'm' || quality === 'menor' ? 'm' : ''}`;
  }

  const parsed = parseChord(value);
  if (!parsed) {
    return null;
  }

  const isMinor = parsed.suffix.startsWith('m') && !parsed.suffix.startsWith('maj');
  return `${parsed.root}${isMinor ? 'm' : ''}`;
}
