import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOcrTokensToStructure, tokensToTextLines, type OcrToken } from '@/music/ocrParser';
import { structureToBracketContent } from '@/utils/song-structure';

const CHAR = 10;
const HEIGHT = 20;

/**
 * Word boxes of a printed page: each row is [line number, column, text];
 * line n sits at y = n * 30 (rows 30 px apart, so an empty line number is a
 * blank line between stanzas).
 */
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

describe('stanzas printed in two columns', () => {
  // First stanza with chords across the page, the others side by side.
  const tokens = page([
    [0, 0, 'C              G'],
    [1, 0, 'Louvai ao Senhor nosso Deus,'],
    [2, 0, 'F              C'],
    [3, 0, 'Que reina com poder e amor.'],
    [5, 0, 'Cantai ao Rei que nos salvou,'],
    [5, 36, 'Erguei as mãos em gratidão,'],
    [6, 0, 'Que guarda o povo seu fiel.'],
    [6, 36, 'Contai seus feitos sem cessar.'],
    [8, 0, 'Os céus proclamam seu poder,'],
    [8, 36, 'Glória ao Pai e ao Filho seu,'],
    [9, 0, 'A terra canta seu amor.'],
    [9, 36, 'E ao Santo Espírito também.'],
  ]);

  it('reads the left column, then the right column', () => {
    assert.deepEqual(
      tokensToTextLines(tokens).map((line) => line.trim()),
      [
        'C              G',
        'Louvai ao Senhor nosso Deus,',
        'F              C',
        'Que reina com poder e amor.',
        '',
        'Cantai ao Rei que nos salvou,',
        'Que guarda o povo seu fiel.',
        '',
        'Os céus proclamam seu poder,',
        'A terra canta seu amor.',
        '',
        'Erguei as mãos em gratidão,',
        'Contai seus feitos sem cessar.',
        '',
        'Glória ao Pai e ao Filho seu,',
        'E ao Santo Espírito também.',
      ],
    );
  });

  it('keeps each stanza whole', () => {
    const sections = parseOcrTokensToStructure(tokens).sections;
    assert.equal(sections.length, 5);
  });

  it('does not split a single column with spaced-out chords', () => {
    const single = page([
      [0, 0, 'G                  C            G'],
      [1, 0, 'Careço de Jesus, de ti, meu Salvador!'],
      [2, 0, 'D             G        A4  A      D'],
      [3, 0, 'Somente a tua voz tem para mim valor.'],
    ]);
    assert.deepEqual(
      tokensToTextLines(single).map((line) => line.trim()),
      [
        'G                  C            G',
        'Careço de Jesus, de ti, meu Salvador!',
        'D             G        A4  A      D',
        'Somente a tua voz tem para mim valor.',
      ],
    );
  });
});
