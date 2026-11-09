import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { recognizedTextToTokens } from '@/music/mlkit';
import { isChordLine } from '@/music/chordParser';
import { groupTokensByLine, parseOcrTokensToStructure, splitChordRun, type OcrToken } from '@/music/ocrParser';
import { structureToBracketContent } from '@/utils/song-structure';

// Word boxes of a photographed chord sheet ("Castelo Forte", public domain),
// with a monospace layout: chords above the syllable where they enter
// (a chord over the middle of a syllable belongs to the whole syllable).
const tokens: OcrToken[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'castelo-forte-tokens.json'), 'utf8'),
);

const EXPECTED = `[Verso 1]
[C]Castelo forte é [G]nosso Deus,
[Am]Amparo e fortale[F]za;
[C]Com seu po[G/B]der defen[Am]de os seus
[F]Em toda a [G7]sua fra[C]queza.

[Refrão]
[F]Nos guar[C]da o Se[Dm7]nhor Je[G]sus`;

/** The same page photographed at an angle (as ML Kit returns it: words grouped in lines). */
function tilt(source: OcrToken[], degrees: number): OcrToken[] {
  const angle = (degrees * Math.PI) / 180;
  return groupTokensByLine(source).flatMap((line, lineIndex) =>
    line.map((token) => {
      const cx = token.x + token.width / 2;
      const cy = token.y + token.height / 2;
      return {
        ...token,
        x: cx * Math.cos(angle) - cy * Math.sin(angle) - token.width / 2,
        y: cx * Math.sin(angle) + cy * Math.cos(angle) - token.height / 2,
        line: lineIndex,
      };
    }),
  );
}

describe('OCR by word positions', () => {
  it('straightens a photo taken at an angle', () => {
    // The G7 sits right between "a" and "sua" on the page, so a tilted photo
    // may put it on either word; everything else must match exactly.
    const loose = (text: string) => text.replace('a [G7]sua', '[G7]a sua');
    for (const degrees of [4, -3]) {
      const result = structureToBracketContent(parseOcrTokensToStructure(tilt(tokens, degrees)));
      assert.equal(loose(result), loose(EXPECTED));
    }
  });

  it('separates chords read without spaces and accepts the hymnal minor (A-)', () => {
    assert.deepEqual(splitChordRun('CD4'), ['C', 'D4']);
    assert.deepEqual(splitChordRun('A4A'), ['A4', 'A']);
    assert.equal(splitChordRun('Deus'), null);
    assert.ok(isChordLine('G   A-'));
    assert.ok(isChordLine('C   G E-'));
  });

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
        { text: 'C', x: 10, y: 5, width: 12, height: 25, line: 0 },
        { text: 'G', x: 200, y: 6, width: 14, height: 25, line: 1 },
      ],
    );
  });
});
