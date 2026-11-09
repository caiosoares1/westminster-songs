import type { OcrToken } from '@/music/ocrParser';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Result of ML Kit text recognition (blocks -> lines -> words with frames). */
export interface RecognizedText {
  text: string;
  blocks: {
    text: string;
    lines: { text: string; frame: Rect; elements: { text: string; frame: Rect }[] }[];
  }[];
}

/** Flattens ML Kit's result into positioned words for the OCR parser. */
export function recognizedTextToTokens(result: RecognizedText): OcrToken[] {
  let lineNumber = 0;
  return (result.blocks ?? []).flatMap((block) =>
    (block.lines ?? []).flatMap((line) => {
      const lineId = lineNumber++;
      return (line.elements ?? [])
        // ML Kit may leave a word without a bounding box.
        .filter((element) => element.text && element.frame)
        .map((element) => ({
          text: element.text,
          x: element.frame.left,
          y: element.frame.top,
          width: element.frame.right - element.frame.left,
          height: element.frame.bottom - element.frame.top,
          line: lineId,
        }));
    }),
  );
}
