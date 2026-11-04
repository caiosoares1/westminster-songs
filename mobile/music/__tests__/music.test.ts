import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSegments } from '@/music/segments';
import { canonicalizeChord, isChordLine, normalizeKey, parseChord } from '@/music/chordParser';
import { parseOcrTextToStructure } from '@/music/ocrParser';
import { getTransposedKey, keyAccidental, transposeChord, transposeStructure } from '@/music/transpose';
import type { SongLine } from '@/services/songs';
import {
  formatSectionHeading,
  isSongStructure,
  normalizeSectionType,
  parseBracketContentToStructure,
  structureToBracketContent,
} from '@/utils/song-structure';

const chordsOf = (line: SongLine) =>
  line.items.filter((item) => item.type === 'chord').map((item) => item.value);

describe('chordParser', () => {
  it('parses common and Brazilian notation', () => {
    for (const chord of ['C', 'Am7', 'F#m7(b5)', 'Bb/D', 'G7(b9)', 'C7M', 'E7/9', 'C6/9', 'C#°', 'Bø', 'Dsus4', 'A9', 'C(add9)']) {
      assert.ok(parseChord(chord), `${chord} should parse`);
    }
    assert.deepEqual(parseChord('E7/9'), { root: 'E', suffix: '7/9', bass: null });
    assert.deepEqual(parseChord('E7/G#'), { root: 'E', suffix: '7', bass: 'G#' });
  });

  it('rejects words', () => {
    for (const word of ['Deus', 'Castelo', 'Amparo', 'graça']) {
      assert.equal(parseChord(word), null, word);
    }
  });

  it('upper-cases the root read by OCR', () => {
    assert.equal(canonicalizeChord('c'), 'C');
    assert.equal(canonicalizeChord('am7'), 'Am7');
  });

  it('normalizes typed keys, including solfège', () => {
    const cases: [string, string | null][] = [
      ['c', 'C'], ['Am7', 'Am'], ['F#m', 'F#m'], ['bb', 'Bb'], ['Cmaj7', 'C'],
      ['Dó', 'C'], ['re menor', 'Dm'], ['Fá#', 'F#'], ['Sib', 'Bb'], ['lá m', 'Am'],
      ['', null], ['Zzz', null], ['H', null],
    ];
    for (const [input, expected] of cases) {
      assert.equal(normalizeKey(input), expected, input);
    }
  });

  it('does not take Portuguese lyrics for chord lines', () => {
    for (const lyric of ['E a graça de Deus', 'A Deus seja a glória', 'Em Cristo eu tenho paz']) {
      assert.equal(isChordLine(lyric), false, lyric);
    }
    assert.equal(isChordLine('Bbm7b5  E7(9)  C#°'), true);
  });
});

describe('transpose', () => {
  it('transposes root, suffix and bass', () => {
    assert.equal(transposeChord('C#m7', 1), 'Dm7');
    assert.equal(transposeChord('G7(b9)', 2), 'A7(b9)');
    assert.equal(transposeChord('C/E', 2), 'D/F#');
  });

  it('spells the new key with flats or sharps by convention', () => {
    assert.equal(getTransposedKey('C', -2), 'Bb');
    assert.equal(getTransposedKey('C', 1), 'Db');
    assert.equal(getTransposedKey('G', -1), 'F#');
    assert.equal(getTransposedKey('Am', 1), 'Bbm');
    assert.equal(getTransposedKey('Am', 4), 'C#m');
    assert.equal(keyAccidental('F'), 'flat');
    assert.equal(keyAccidental('E'), 'sharp');
  });

  it('uses the target key spelling for every chord', () => {
    const structure = {
      sections: [{ type: 'verse', lines: [{ items: [
        { type: 'chord' as const, value: 'C' },
        { type: 'chord' as const, value: 'G/B' },
        { type: 'chord' as const, value: 'A7' },
      ] }] }],
    };
    // C -> Bb (flat key): A7 -> G7, G/B -> F/A, and no sharps appear.
    assert.deepEqual(chordsOf(transposeStructure(structure, -2, 'C').sections[0].lines[0]), ['Bb', 'F/A', 'G7']);
    // C -> D (sharp key)
    assert.deepEqual(chordsOf(transposeStructure(structure, 2, 'C').sections[0].lines[0]), ['D', 'A/C#', 'B7']);
  });
});

describe('sections', () => {
  it('normalizes Portuguese names with accents and numbers', () => {
    assert.equal(normalizeSectionType('Refrão'), 'chorus');
    assert.equal(normalizeSectionType('[Verso 2]:'), 'verse 2');
    assert.equal(normalizeSectionType('Pré-refrão'), 'prechorus');
    assert.equal(formatSectionHeading('verse 2'), 'Verso 2');
    assert.equal(formatSectionHeading('chorus'), 'Refrão');
  });

  it('treats a chord-only bracket line as a line, not a section', () => {
    const structure = parseBracketContentToStructure(
      '[Verso]\n[G]\n[C7M] [E7/9] [Am7] [G/B]\n[C]Castelo forte',
    );
    assert.equal(structure.sections.length, 1);
    assert.equal(structure.sections[0].lines.length, 3);
    assert.deepEqual(chordsOf(structure.sections[0].lines[1]), ['C7M', 'E7/9', 'Am7', 'G/B']);
  });
});

describe('OCR text parser', () => {
  const ocr = `Verso 1

c               G

Castelo forte é nosso Deus,
Am              F

Amparo e fortaleza;

Refrão

F       c       Dm7 G
Nos guarda o Senhor Jesus`;

  const structure = parseOcrTextToStructure(ocr);

  it('detects sections including accented ones', () => {
    assert.deepEqual(structure.sections.map((section) => section.type), ['verse 1', 'chorus']);
  });

  it('pairs chord lines with lyrics and fixes lower-case chords', () => {
    const first = structure.sections[0].lines[0];
    assert.deepEqual(chordsOf(first), ['C', 'G']);
    assert.equal(
      first.items.map((item) => (item.type === 'lyric' ? item.value : '')).join(''),
      'Castelo forte é nosso Deus,',
    );
    assert.deepEqual(chordsOf(structure.sections[1].lines[0]), ['F', 'C', 'Dm7', 'G']);
  });

  it('round-trips through the bracket editor format', () => {
    const roundTrip = parseBracketContentToStructure(structureToBracketContent(structure));
    assert.deepEqual(roundTrip, structure);
  });
});

describe('ChordLine segments', () => {
  it('puts each chord over the lyric that follows it, without padding the lyric', () => {
    const segments = buildSegments({ items: [
      { type: 'lyric', value: 'Amparo e ' },
      { type: 'chord', value: 'F' },
      { type: 'lyric', value: 'fortaleza' },
    ] });
    assert.deepEqual(segments, [
      { chord: null, lyric: 'Amparo e ' },
      { chord: 'F', lyric: 'fortaleza' },
    ]);
    assert.equal(segments.map((segment) => segment.lyric).join(''), 'Amparo e fortaleza');
  });

  it('keeps consecutive chords as separate segments', () => {
    assert.deepEqual(buildSegments({ items: [
      { type: 'chord', value: 'C' },
      { type: 'chord', value: 'G' },
    ] }), [{ chord: 'C', lyric: '' }, { chord: 'G', lyric: '' }]);
  });
});

describe('isSongStructure', () => {
  it('accepts valid data and rejects malformed rows', () => {
    assert.equal(isSongStructure(structureForCheck()), true);
    assert.equal(isSongStructure({ foo: 1 }), false);
    assert.equal(isSongStructure({ sections: [{ type: 'verse', lines: [{ items: [{ type: 'x', value: 1 }] }] }] }), false);
    assert.equal(isSongStructure(null), false);
  });
});

function structureForCheck() {
  return { sections: [{ type: 'verse', lines: [{ items: [{ type: 'lyric', value: 'oi' }] }] }] };
}
