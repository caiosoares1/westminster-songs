import { requireOptionalNativeModule } from 'expo';

import { recognizedTextToTokens, type RecognizedText } from '@/music/mlkit';
import type { OcrToken } from '@/music/ocrParser';

// On-device text recognition (Google ML Kit) from
// @infinitered/react-native-mlkit-text-recognition. Loaded by its native
// module name so the app doesn't crash where the module isn't compiled in
// (Expo Go, web): there it is null and the import by photo is unavailable.
interface TextRecognitionModule {
  recognizeText: (imageUri: string) => Promise<RecognizedText>;
}

const textRecognition = requireOptionalNativeModule<TextRecognitionModule>('RNMLKitTextRecognition');

export const isDeviceOcrAvailable = textRecognition !== null;

export interface OcrResult {
  fullText: string;
  /** Each recognized word with its position, used to align chords and lyrics. */
  tokens: OcrToken[];
}

export async function recognizeImage(imageUri: string): Promise<OcrResult> {
  if (!textRecognition) {
    throw new Error('OCR indisponivel neste app');
  }

  const result = await textRecognition.recognizeText(imageUri);
  return { fullText: result.text, tokens: recognizedTextToTokens(result) };
}

/**
 * Word positions as plain text, to send when a photo is read wrong and the
 * case needs to be reproduced: one word per line, "line x y width height text".
 */
export function describeTokens(tokens: OcrToken[]): string {
  return tokens
    .map((token) =>
      [token.line ?? -1, token.x, token.y, token.width, token.height]
        .map((value) => Math.round(value))
        .join(' ')
        .concat(` ${token.text}`),
    )
    .join('\n');
}
