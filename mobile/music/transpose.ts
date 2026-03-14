import type { SongStructure } from '@/services/songs';
import { parseChord } from '@/music/chordParser';

const CHROMATIC_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

function normalizeSteps(steps: number): number {
  const normalized = steps % 12;
  return normalized >= 0 ? normalized : normalized + 12;
}

export function transposeNote(note: string, steps: number): string {
  const normalizedNote = FLAT_TO_SHARP[note] ?? note;
  const noteIndex = CHROMATIC_SHARPS.indexOf(normalizedNote);

  if (noteIndex === -1) {
    return note;
  }

  const nextIndex = (noteIndex + normalizeSteps(steps)) % CHROMATIC_SHARPS.length;
  const transposedSharp = CHROMATIC_SHARPS[nextIndex];

  if (note.includes('b')) {
    return SHARP_TO_FLAT[transposedSharp] ?? transposedSharp;
  }

  return transposedSharp;
}

export function transposeChord(chord: string, steps: number): string {
  if (!chord || steps === 0) {
    return chord;
  }

  const parsedChord = parseChord(chord);
  if (!parsedChord) {
    return chord;
  }

  const { root, suffix, bass } = parsedChord;
  const transposedRoot = transposeNote(root, steps);
  const transposedBass = bass ? transposeNote(bass, steps) : null;

  return `${transposedRoot}${suffix}${transposedBass ? `/${transposedBass}` : ''}`;
}

export function getTransposedKey(originalKey: string, steps: number): string {
  return transposeChord(originalKey, steps);
}

export function transposeStructure(structureJson: SongStructure, steps: number): SongStructure {
  if (steps === 0) {
    return structureJson;
  }

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
                value: transposeChord(item.value, steps),
              }
            : item
        ),
      })),
    })),
  };
}
