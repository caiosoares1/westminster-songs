import type { SongStructure } from '@/services/songs';
import { parseChord } from '@/music/chordParser';

const CHROMATIC_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

// Keys conventionally written with flats (by pitch class of the tonic).
const FLAT_MAJOR_KEYS = new Set([5, 10, 3, 8, 1]); // F Bb Eb Ab Db
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3]); // Dm Gm Cm Fm Bbm Ebm

export type Accidental = 'sharp' | 'flat';

function normalizeSteps(steps: number): number {
  const normalized = steps % 12;
  return normalized >= 0 ? normalized : normalized + 12;
}

/**
 * Whether a key is written with sharps or flats, e.g. F -> flat, A -> sharp,
 * Dm -> flat. Returns null when the key can't be parsed.
 */
export function keyAccidental(key: string): Accidental | null {
  const parsed = parseChord(key);
  if (!parsed) {
    return null;
  }

  const index = NOTE_INDEX[parsed.root];
  if (index === undefined) {
    return null;
  }

  const isMinor = parsed.suffix.startsWith('m') && !parsed.suffix.startsWith('maj');
  const flatKeys = isMinor ? FLAT_MINOR_KEYS : FLAT_MAJOR_KEYS;
  if (flatKeys.has(index)) {
    return 'flat';
  }

  // C major / A minor: follow how the key itself is spelled.
  return parsed.root.includes('b') ? 'flat' : 'sharp';
}

export function transposeNote(note: string, steps: number, accidental?: Accidental): string {
  const noteIndex = NOTE_INDEX[note];
  if (noteIndex === undefined) {
    return note;
  }

  const nextIndex = (noteIndex + normalizeSteps(steps)) % 12;
  const useFlats = accidental ? accidental === 'flat' : note.includes('b');
  return (useFlats ? CHROMATIC_FLATS : CHROMATIC_SHARPS)[nextIndex];
}

/**
 * Transposes a chord. `accidental` picks sharps or flats for the result;
 * when omitted, the chord's own spelling is kept.
 */
export function transposeChord(chord: string, steps: number, accidental?: Accidental): string {
  if (!chord || steps === 0) {
    return chord;
  }

  const parsedChord = parseChord(chord);
  if (!parsedChord) {
    return chord;
  }

  const { root, suffix, bass } = parsedChord;
  const transposedRoot = transposeNote(root, steps, accidental);
  const transposedBass = bass ? transposeNote(bass, steps, accidental) : null;

  return `${transposedRoot}${suffix}${transposedBass ? `/${transposedBass}` : ''}`;
}

/** The new key, spelled the way that key is conventionally written. */
export function getTransposedKey(originalKey: string, steps: number): string {
  if (steps === 0) {
    return originalKey;
  }

  const sharpSpelling = transposeChord(originalKey, steps, 'sharp');
  const accidental = keyAccidental(sharpSpelling) ?? 'sharp';
  return transposeChord(originalKey, steps, accidental);
}

export function transposeStructure(
  structureJson: SongStructure,
  steps: number,
  originalKey?: string,
): SongStructure {
  if (steps === 0) {
    return structureJson;
  }

  const targetKey = originalKey ? getTransposedKey(originalKey, steps) : null;
  const accidental = targetKey ? (keyAccidental(targetKey) ?? undefined) : undefined;

  return {
    ...structureJson,
    sections: structureJson.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        items: line.items.map((item) =>
          item.type === 'chord'
            ? {
                ...item,
                value: transposeChord(item.value, steps, accidental),
              }
            : item,
        ),
      })),
    })),
  };
}
