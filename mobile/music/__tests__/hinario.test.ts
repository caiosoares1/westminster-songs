import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { combineStructures } from '@/music/combine';
import { extractHymnHeader, parseHymnHeader } from '@/music/hymnHeader';
import { findDoubtfulChords, parseOcrTextToStructure } from '@/music/ocrParser';
import { applyChordPattern, sungSyllableStarts, syllableStarts } from '@/music/pattern';
import { parseBracketContentToStructure, structureToBracketContent } from '@/utils/song-structure';

const bracket = (text: string) => parseBracketContentToStructure(text);
const lineOf = (text: string) => bracket(text).sections[0].lines[0];

describe('hymnal heading', () => {
  it('reads number, title, key and time signature', () => {
    assert.deepEqual(parseHymnHeader('120 DEPENDÊNCIA. G 3/4'), {
      number: '120',
      title: 'Dependência',
      key: 'G',
      timeSignature: '3/4',
    });
    assert.equal(parseHymnHeader('120 DEPENDÊNCIA. G 34')?.timeSignature, '3/4');
    assert.deepEqual(parseHymnHeader('16B PRESERVA-ME, O DEUS. C 4/4'), {
      number: '16B',
      title: 'Preserva-me, o Deus',
      key: 'C',
      timeSignature: '4/4',
    });
    assert.deepEqual(parseHymnHeader('15 CASTELO FORTE'), { number: '15', title: 'Castelo Forte' });
    assert.equal(parseHymnHeader('3 Louvai ao Senhor nosso Deus'), null);
  });

  it('takes the heading and the end of the previous hymn out of the lyrics', () => {
    const structure = parseOcrTextToStructure(
      [
        'Do amor e graça que vêm de Jesus. Amém.',
        '',
        '120 DEPENDÊNCIA.    G   3/4',
        '',
        'G                C',
        'Careço de Jesus, de ti',
      ].join('\n'),
    );
    const { structure: rest, header } = extractHymnHeader(structure);
    assert.equal(header?.title, 'Dependência');
    assert.equal(structureToBracketContent(rest), '[Verso]\n[G]Careço de Jesus, [C]de ti');
  });
});

describe('chorus printed indented', () => {
  it('marks the indented stanza as the chorus', () => {
    const structure = parseOcrTextToStructure(
      [
        'G              C',
        'Careço de Jesus, de ti, meu Salvador!',
        'Somente a tua voz tem para mim valor.',
        '',
        '    G           A-',
        '    De ti, Senhor careço!',
        '    Do teu amparo sempre!',
        '',
        'Careço de Jesus! Unido a ti Senhor,',
        'Pecado e tentação não mais terão vigor',
      ].join('\n'),
    );
    assert.deepEqual(
      structure.sections.map((section) => section.type),
      ['verse', 'chorus', 'verse 2'],
    );
  });

  it('leaves stanzas that are all at the same margin as verses', () => {
    const structure = parseOcrTextToStructure('Linha um da estrofe\nLinha dois da estrofe\n\nOutra estrofe aqui\nE mais uma linha');
    assert.deepEqual(
      structure.sections.map((section) => section.type),
      ['verse', 'verse 2'],
    );
  });
});

describe('doubtful chords', () => {
  it('points at words on chord lines that are not chords', () => {
    assert.deepEqual(findDoubtfulChords(['D     Ag    D', 'Careço de Jesus', 'G   C   G']), ['"Ag" em "D Ag D"']);
  });

  it('ignores lyrics and repeat marks', () => {
    assert.deepEqual(findDoubtfulChords(['Glória a Deus', 'G  C  |  D  (x2)']), []);
  });
});

describe('photos that overlap', () => {
  it('drops the lines read in both photos, keeping the copy with chords', () => {
    const first = bracket('[Verso]\nLinha um da estrofe\nLinha dois da estrofe\nLinha três da estrofe');
    const second = bracket('Linha dois da estrofe\n[G]Linha três da es[C]trofe\nLinha quatro da estrofe');
    assert.equal(
      structureToBracketContent(combineStructures([first, second], [false, true])),
      '[Verso]\nLinha um da estrofe\nLinha dois da estrofe\n[G]Linha três da es[C]trofe\nLinha quatro da estrofe',
    );
  });

  it('tolerates small reading differences', () => {
    const first = bracket('[Verso]\nO Senhor é meu pastor');
    const second = bracket('O Senhor e meu pastar\nNada me faltará');
    assert.equal(
      structureToBracketContent(combineStructures([first, second], [false, true])),
      '[Verso]\nO Senhor é meu pastor\nNada me faltará',
    );
  });
});

describe('joined vowels (elision)', () => {
  it('counts "minha alma" as sung', () => {
    assert.equal(syllableStarts('minha alma').length, 4);
    assert.equal(sungSyllableStarts('minha alma').length, 3);
  });

  it('keeps the chords on the right syllable when one line joins vowels', () => {
    // Model: 6 syllables. Target: 7 written, 6 sung ("pro-cla-ma_o-teu-a-mor").
    const model = lineOf('[C]Can-ta-rei [G]teu [F]a[C]mor');
    const target = lineOf('Proclama o teu amor');
    assert.equal(structureToBracketContent({ sections: [{ type: 'verse', lines: [applyChordPattern(model, target)] }] }).split('\n')[1], '[C]Proclama o [G]teu [F]a[C]mor');
  });
});
