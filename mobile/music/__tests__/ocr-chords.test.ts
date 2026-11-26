import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isChordToken, normalizeChordToken } from '@/music/chordParser';
import { extractHymnHeader, parseTitleHeader } from '@/music/hymnHeader';
import { findDoubtfulChords, parseOcrTokensToStructure, tokensToTextLines, type OcrToken } from '@/music/ocrParser';
import { transposeChord } from '@/music/transpose';
import { structureToBracketContent } from '@/utils/song-structure';

const CHAR = 10;
const HEIGHT = 20;

/** Word boxes of a printed page: [line, column, text], one box per word. */
function page(rows: [number, number, string][]): OcrToken[] {
  const tokens: OcrToken[] = [];
  rows.forEach(([line, column, text], rowIndex) => {
    let offset = 0;
    for (const word of text.split(' ')) {
      if (word) {
        tokens.push({
          text: word,
          x: 20 + (column + offset) * CHAR,
          y: 40 + line * 30,
          width: word.length * CHAR,
          height: HEIGHT,
          line: rowIndex,
        });
      }
      offset += word.length + 1;
    }
  });
  return tokens;
}

/** Splits the word box at `column` into pieces that touch, as OCR does with "A/E". */
function splitBox(tokens: OcrToken[], text: string, pieces: string[]): OcrToken[] {
  const index = tokens.findIndex((token) => token.text === text);
  const original = tokens[index];
  let x = original.x;
  const parts = pieces.map((piece) => {
    const part = { ...original, text: piece, x, width: piece.length * CHAR };
    x += piece.length * CHAR;
    return part;
  });
  return [...tokens.slice(0, index), ...parts, ...tokens.slice(index + 1)];
}

// Salmo 11 (Comissão Brasileira de Salmodia), first lines.
const SALMO_11: [number, number, string][] = [
  [0, 0, '            D         A6       Bm7'],
  [1, 0, '1. Meu refúgio está em Deus.'],
  [2, 0, '          G       D/F#  A4(7)'],
  [3, 0, 'Como podes me dizer'],
  [4, 0, 'A/G   D/F#         F#7  A/E  Bm7'],
  [5, 0, '"Qual ave foge ao monte   seu,'],
  [6, 0, '         Bm7       E4(7)    A'],
  [7, 0, 'têm já pronto o arco à mão'],
];

describe('chords with a parenthesized suffix', () => {
  it('are chords', () => {
    for (const chord of ['A4(7)', 'E4(7)', 'C7(9)', 'G7(b13)', 'D(add9)', 'Bm7(11)']) {
      assert.equal(isChordToken(chord), true, chord);
    }
  });

  it('keep the closing parenthesis, and get back one the OCR missed', () => {
    assert.equal(normalizeChordToken('A4(7)'), 'A4(7)');
    assert.equal(normalizeChordToken('A4(7),'), 'A4(7)');
    assert.equal(normalizeChordToken('A4(7'), 'A4(7)');
    assert.equal(normalizeChordToken('(D)'), 'D');
  });

  it('are placed over the lyrics and not reported as doubtful', () => {
    const tokens = page(SALMO_11);
    const content = structureToBracketContent(parseOcrTokensToStructure(tokens));
    assert.match(content, /\[A4\(7\)\]/);
    assert.match(content, /\[E4\(7\)\]/);
    assert.deepEqual(findDoubtfulChords(tokensToTextLines(tokens)), []);
  });

  it('transpose', () => {
    assert.equal(transposeChord('A4(7)', 2), 'B4(7)');
  });
});

describe('slash chords the OCR split into pieces', () => {
  const pieces: [string, string[]][] = [
    ['A / E', ['A', '/', 'E']],
    ['A/ E', ['A/', 'E']],
    ['A /E', ['A', '/E']],
  ];
  for (const [name, parts] of pieces) {
    it(`"${name}" is read as A/E`, () => {
      const tokens = splitBox(page(SALMO_11), 'A/E', parts);
      const content = structureToBracketContent(parseOcrTokensToStructure(tokens));
      assert.match(content, /\[A\/E\]/);
      assert.doesNotMatch(content, /\[E\]/);
    });
  }

  it('keeps chords and beat marks with spaces between them apart', () => {
    const content = structureToBracketContent(
      parseOcrTokensToStructure(page([[0, 0, 'C    /    G'], [1, 0, 'Louvai ao Senhor nosso Deus']])),
    );
    assert.match(content, /\[C\]/);
    assert.match(content, /\[G\]/);
    assert.doesNotMatch(content, /C\/G/);
  });
});

describe('title and credits printed above the first stanza', () => {
  const sheet: [number, number, string][] = [
    [0, 26, 'SALMO 11'],
    [1, 24, 'Letra: Comissão Brasileira de Salmodia'],
    [3, 0, '            D         A6       Bm7'],
    [4, 0, '1. Meu refúgio está em Deus.'],
    [5, 0, '          G       D/F#  A4(7)'],
    [6, 0, 'Como podes me dizer'],
  ];

  it('become the title, not a chorus', () => {
    const { structure, header } = extractHymnHeader(parseOcrTokensToStructure(page(sheet)));
    assert.deepEqual(header, { title: 'Salmo 11' });
    const content = structureToBracketContent(structure);
    assert.doesNotMatch(content, /SALMO|Letra|Refrão/);
    assert.match(content, /^\[Verso\]\nMeu /);
  });

  it('a title is only taken when it stands alone in capitals', () => {
    assert.equal(parseTitleHeader('Meu refúgio está em Deus'), null);
    assert.equal(parseTitleHeader('SANTO, SANTO, SANTO, DEUS ONIPOTENTE, VEM NOS LOUVAR'), null);
    assert.deepEqual(parseTitleHeader('CASTELO FORTE'), { title: 'Castelo Forte' });

    const lyricsInCapitals = parseOcrTokensToStructure(
      page([
        [0, 0, 'C          G'],
        [1, 0, 'SANTO, SANTO'],
        [2, 0, 'Deus onipotente'],
      ]),
    );
    assert.equal(extractHymnHeader(lyricsInCapitals).header, null);
  });
});
