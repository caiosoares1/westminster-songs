import { useCallback, useEffect, useState } from 'react';

import { transposeChord } from '@/music/transpose';

export function useTranspose(originalKey: string) {
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    setSteps(0);
  }, [originalKey]);

  const currentKey = transposeChord(originalKey, steps);

  const transposeUp = useCallback(() => {
    setSteps((previous) => previous + 1);
  }, []);

  const transposeDown = useCallback(() => {
    setSteps((previous) => previous - 1);
  }, []);

  const resetTranspose = useCallback(() => {
    setSteps(0);
  }, []);

  return {
    steps,
    currentKey,
    transposeUp,
    transposeDown,
    resetTranspose,
  };
}
