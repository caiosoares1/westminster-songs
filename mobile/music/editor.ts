import { parseOcrTextToStructure } from '@/music/ocrParser';
import { fillChordsFromPattern } from '@/music/pattern';
import { getTransposedKey, transposeStructure } from '@/music/transpose';
import {
  parseBracketContentToStructure,
  structureToBracketContent,
} from '@/utils/song-structure';

/**
 * Converts a chord sheet pasted in the "chords above the lyrics" layout used
 * by chord sites into the editor's bracket format, and fills stanzas that
 * have only lyrics with the chords of the chorded stanza (same melody):
 *
 *   C          G              [C]Castelo forte é [G]nosso Deus
 *   Castelo forte é nosso Deus   ->
 *
 * Lines already in bracket format and section headings are kept.
 */
export function chordsAboveLyricsToBracket(text: string): string {
  return structureToBracketContent(fillChordsFromPattern(parseOcrTextToStructure(text)));
}

/** Transposes the editor content and its key by `steps` semitones. */
export function transposeEditorContent(
  content: string,
  key: string,
  steps: number,
): { content: string; key: string } {
  const structure = parseBracketContentToStructure(content);
  return {
    content: structureToBracketContent(transposeStructure(structure, steps, key)),
    key: getTransposedKey(key, steps),
  };
}
