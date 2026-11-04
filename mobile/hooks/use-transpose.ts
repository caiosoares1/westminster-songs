import { useCallback, useEffect, useState } from 'react';

import { getTransposedKey, semitonesBetween } from '@/music/transpose';

/**
 * Transposition state for a song. `startKey` opens it already transposed,
 * e.g. in the key chosen for a setlist; Reset goes back to that key.
 */
export function useTranspose(originalKey: string, startKey?: string) {
  const initialSteps = startKey ? semitonesBetween(originalKey, startKey) : 0;
  const [steps, setSteps] = useState(initialSteps);

  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const currentKey = getTransposedKey(originalKey, steps);

  const transposeUp = useCallback(() => {
    setSteps((previous) => previous + 1);
  }, []);

  const transposeDown = useCallback(() => {
    setSteps((previous) => previous - 1);
  }, []);

  const resetTranspose = useCallback(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  return {
    steps,
    currentKey,
    transposeUp,
    transposeDown,
    resetTranspose,
  };
}
