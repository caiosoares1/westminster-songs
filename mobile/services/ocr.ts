import type { OcrToken } from '@/music/ocrParser';
import api from '@/services/api';

export interface OcrExtractResult {
  fullText: string;
  tokens: OcrToken[];
}

interface OcrExtractResponse {
  fullText: string;
  tokens?: OcrToken[];
}

export async function extractTextFromImageBase64(base64Content: string): Promise<OcrExtractResult> {
  // Uploading a photo and running OCR can take longer than the default 10s.
  const { data } = await api.post<OcrExtractResponse>(
    '/ocr/extract',
    { imageBase64: base64Content },
    { timeout: 60_000 },
  );

  return {
    fullText: data.fullText,
    tokens: Array.isArray(data.tokens) ? data.tokens : [],
  };
}
