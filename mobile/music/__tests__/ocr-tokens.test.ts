import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { recognizedTextToTokens } from '@/music/mlkit';
import { parseOcrTokensToStructure, type OcrToken } from '@/music/ocrParser';
import { structureToBracketContent } from '@/utils/song-structure';

// Word boxes of a photographed chord sheet ("Castelo Forte", public domain),
// with a monospace layout: chords above the syllable where they enter.
const tokens: OcrToken[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'castelo-forte-tokens.json'), 'utf8'),
);

const EXPECTED = `[Verso 1]
[C]Castelo forte é [G]nosso Deus,
[Am]Amparo e fortale[F]za;
[C]Com seu pod[G/B]er defen[Am]de os seus
[F]Em toda a[G7] sua fraqu[C]eza.

[Refrão]
[F]Nos guard[C]a o Sen[Dm7]hor Je[G]sus`;

describe('OCR by word positions', () => {
  it('aligns chords with the lyrics using one column grid for the page', () => {
    assert.equal(structureToBracketContent(parseOcrTokensToStructure(tokens)), EXPECTED);
  });

  it('gives the same result for a bigger photo (positions scale with resolution)', () => {
    const scaled = tokens.map((token) => ({
      ...token,
      x: token.x * 3 + 40,
      y: token.y * 3 + 90,
      width: token.width * 3,
      height: token.height * 3,
    }));
    assert.equal(structureToBracketContent(parseOcrTokensToStructure(scaled)), EXPECTED);
  });

  it('is not confused by word order (ML Kit groups words in blocks)', () => {
    const shuffled = [...tokens].reverse();
    assert.equal(structureToBracketContent(parseOcrTokensToStructure(shuffled)), EXPECTED);
  });

  it('flattens ML Kit blocks/lines/elements into positioned words', () => {
    const frame = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });
    assert.deepEqual(
      recognizedTextToTokens({
        text: 'C G',
        blocks: [
          { text: 'C', lines: [{ text: 'C', frame: frame(10, 5, 22, 30), elements: [{ text: 'C', frame: frame(10, 5, 22, 30) }] }] },
          { text: 'G', lines: [{ text: 'G', frame: frame(200, 6, 214, 31), elements: [{ text: 'G', frame: frame(200, 6, 214, 31) }] }] },
        ],
      }),
      [
        { text: 'C', x: 10, y: 5, width: 12, height: 25 },
        { text: 'G', x: 200, y: 6, width: 14, height: 25 },
      ],
    );
  });
});
