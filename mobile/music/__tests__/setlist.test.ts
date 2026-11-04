import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getTransposedKey, semitonesBetween } from '@/music/transpose';
import { formatServiceDate, parseServiceDateInput } from '@/utils/service-date';

describe('service dates', () => {
  it('shows the stored day regardless of the device time zone', () => {
    // Midnight UTC is still the previous evening in Brazil (UTC-3).
    assert.equal(formatServiceDate('2026-11-08T00:00:00.000Z'), '08/11/2026');
  });

  it('parses dd/mm/aaaa and rejects impossible dates', () => {
    assert.equal(parseServiceDateInput('08/11/2026'), '2026-11-08');
    assert.equal(parseServiceDateInput(' 1/2/2027 '), '2027-02-01');
    assert.equal(parseServiceDateInput('31/02/2026'), null);
    assert.equal(parseServiceDateInput('2026-11-08'), null);
    assert.equal(parseServiceDateInput('amanhã'), null);
  });
});

describe('semitonesBetween', () => {
  it('takes the shorter way and round-trips with getTransposedKey', () => {
    assert.equal(semitonesBetween('C', 'D'), 2);
    assert.equal(semitonesBetween('C', 'Bb'), -2);
    assert.equal(semitonesBetween('G', 'C'), 5);
    assert.equal(semitonesBetween('Am', 'Em'), -5);
    assert.equal(semitonesBetween('C', 'F#'), 6);
    assert.equal(semitonesBetween('C', '???'), 0);
    for (const [from, to] of [['C', 'Bb'], ['A', 'Db'], ['Em', 'Gm'], ['F', 'E']]) {
      assert.equal(getTransposedKey(from, semitonesBetween(from, to)), to, `${from} -> ${to}`);
    }
  });
});
