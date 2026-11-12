import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guessCategory } from '@/constants/categories';

describe('song type from the title', () => {
  it('recognizes psalms, hymns and leaves the rest unset', () => {
    assert.equal(guessCategory('Salmo 16b'), 'psalm');
    assert.equal(guessCategory('Preserva-me, o Deus', '16B'), 'psalm');
    assert.equal(guessCategory('HNC 120 Dependência'), 'hymn');
    assert.equal(guessCategory('Dependência', '120'), 'hymn');
    assert.equal(guessCategory('120 Dependência'), 'hymn');
    assert.equal(guessCategory('Grande é o Senhor'), null);
  });
});
