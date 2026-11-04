import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chordsAboveLyricsToBracket, transposeEditorContent } from '@/music/editor';

describe('editor tools', () => {
  it('converts a chord sheet pasted from a chord site', () => {
    const pasted = ['Refrão', 'F        C        Dm7  G', 'Nos guarda o Senhor Jesus'].join('\n');
    assert.equal(chordsAboveLyricsToBracket(pasted), '[Refrão]\n[F]Nos guard[C]a o Senho[Dm7]r Jes[G]us');
  });

  it('keeps lines that are already in bracket format', () => {
    const content = '[Verso]\n[C]Castelo forte é [G]nosso Deus';
    assert.equal(chordsAboveLyricsToBracket(content), content);
  });

  it('transposes the content and the key together', () => {
    const result = transposeEditorContent('[Verso]\n[C]Castelo [G/B]forte [Am7]é', 'C', -2);
    assert.equal(result.key, 'Bb');
    assert.equal(result.content, '[Verso]\n[Bb]Castelo [F/A]forte [Gm7]é');
  });
});
