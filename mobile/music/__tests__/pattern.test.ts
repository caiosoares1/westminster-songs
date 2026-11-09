import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { combineStructures } from '@/music/combine';
import { parseOcrTextToStructure } from '@/music/ocrParser';
import { applyChordPattern, canFillChordsFromPattern, fillChordsFromPattern, syllableStarts } from '@/music/pattern';
import type { SongLine } from '@/services/songs';
import { parseBracketContentToStructure, structureToBracketContent } from '@/utils/song-structure';


const syllables = (text: string) => {
  const starts = syllableStarts(text);
  return starts.map((start, index) => text.slice(start, starts[index + 1] ?? text.length).trimEnd());
};

const line = (content: string): SongLine => parseBracketContentToStructure(content).sections[0].lines[0];
const show = (value: SongLine) => structureToBracketContent({ sections: [{ type: 'verse', lines: [value] }] }).split('\n')[1];

describe('syllables', () => {
  it('splits Portuguese words close to how they are sung', () => {
    assert.deepEqual(syllables('fortaleza'), ['for', 'ta', 'le', 'za']);
    assert.deepEqual(syllables('palavra'), ['pa', 'la', 'vra']);
    assert.deepEqual(syllables('Castelo forte'), ['Cas', 'te', 'lo', 'for', 'te']);
    assert.deepEqual(syllables('minha alma'), ['mi', 'nha', 'al', 'ma']);
  });
});

describe('applyChordPattern', () => {
  it('puts each chord on the same syllable of the new line', () => {
    // Lou-vai ao Se-nhor nos-so Deus  ->  Can-tai ao Rei que nos sal-vou
    const model = line('[C]Louvai ao Se[G]nhor nosso [Am]Deus');
    assert.equal(
      show(applyChordPattern(model, line('Cantai ao Rei que nos salvou'))),
      '[C]Cantai ao Rei [G]que nos sal[Am]vou',
    );
  });

  it('uses the syllable that contains the chord, even mid-syllable', () => {
    const model = line('[C]Louvai ao Senho[G]r nosso Deus');
    assert.equal(show(applyChordPattern(model, line('Cantai ao Rei que nos salvou'))), '[C]Cantai ao Rei [G]que nos salvou');
  });

  it('maps proportionally when the syllable count differs', () => {
    const model = line('[C]Louvai ao Se[G]nhor nosso [Am]Deus');
    // 8 syllables -> 4: chords spread over the shorter line.
    assert.equal(show(applyChordPattern(model, line('Glória a Deus'))), '[C]Glória [G]a [Am]Deus');
  });

  it('places a chord after the last syllable at the end of the line', () => {
    const model = line('[D]Bendito [A]seja[D]');
    assert.equal(show(applyChordPattern(model, line('Louvado seja'))), '[D]Louvado [A]seja[D]');
  });
});

describe('fillChordsFromPattern', () => {
  const sheet = `C              G
Louvai ao Senhor nosso Deus,
Am             F
Que reina com poder e amor.

Refrão
F        G       C
Aleluia, aleluia!

2. Cantai ao Rei que nos salvou,
Que guarda o povo seu fiel.

3. Erguei as mãos em gratidão,
Contai seus feitos sem cessar.`;

  const structure = parseOcrTextToStructure(sheet);

  it('splits numbered stanzas into their own sections', () => {
    assert.deepEqual(structure.sections.map((section) => section.type), ['verse', 'chorus', 'verse 2', 'verse 3']);
    assert.equal(canFillChordsFromPattern(structure), true);
  });

  it('fills stanzas without chords with the chords of the first stanza, not the chorus', () => {
    const filled = fillChordsFromPattern(structure);
    const text = structureToBracketContent(filled);
    assert.match(text, /\[Verso 2\]\n\[C\]Cantai ao Rei \[G\]que nos salvou,\n\[Am\]Que guarda o \[F\]povo seu fiel\./);
    assert.match(text, /\[Verso 3\]\n\[C\]Erguei as mãos \[G\]em gratidão,/);
    // Sections that already had chords are untouched.
    assert.deepEqual(filled.sections[0], structure.sections[0]);
    assert.deepEqual(filled.sections[1], structure.sections[1]);
    assert.equal(canFillChordsFromPattern(filled), false);
  });

  it('recognizes a repeated chorus by its words and fills it from the chorus', () => {
    const withRepeat = parseOcrTextToStructure(`${sheet}\n\nAleluia, aleluia!`);
    assert.equal(withRepeat.sections.at(-1)?.type, 'chorus');
    assert.match(structureToBracketContent(fillChordsFromPattern(withRepeat)), /\[Refrão\]\n\[F\]Aleluia, \[G\]aleluia!\[C\]$/);
  });
});

describe('blank lines and stanzas', () => {
  it('ignores blank lines that are OCR noise (one after almost every line)', () => {
    const noisy = 'C        G\n\nLouvai ao Senhor\n\nAm       F\n\nQue reina com poder\n';
    const parsed = parseOcrTextToStructure(noisy);
    assert.equal(parsed.sections.length, 1);
    assert.equal(parsed.sections[0].lines.length, 2);
  });

  it('starts a new stanza at a blank line in the editor format', () => {
    const parsed = parseBracketContentToStructure('[Verso]\n[C]Louvai\n\nCantai\n\n[Refrão]\n[F]Aleluia');
    assert.deepEqual(parsed.sections.map((section) => section.type), ['verse', 'verse 2', 'chorus']);
  });
});

describe('combineStructures (several photos)', () => {
  const photo1 = parseOcrTextToStructure('C        G\nLouvai ao Senhor nosso Deus,\nAm       F\nQue reina com poder');
  const photo2 = parseOcrTextToStructure('e com amor sem fim.\n\n2. Cantai ao Rei que nos salvou,');

  it('continues the cut stanza and renumbers the following ones', () => {
    const combined = combineStructures([photo1, photo2], [false, true]);
    assert.deepEqual(combined.sections.map((section) => section.type), ['verse', 'verse 2']);
    assert.equal(combined.sections[0].lines.length, 3);
  });

  it('keeps sections apart when the next photo starts with a title', () => {
    const titled = parseOcrTextToStructure('Refrão\nF   G\nAleluia');
    const combined = combineStructures([photo1, titled], [false, false]);
    assert.deepEqual(combined.sections.map((section) => section.type), ['verse', 'chorus']);
  });
});
