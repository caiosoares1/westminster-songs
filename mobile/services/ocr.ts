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
  const { data } = await api.post<OcrExtractResponse>('/ocr/extract', {
    imageBase64: base64Content,
  });

  return {
    fullText: data.fullText,
    tokens: Array.isArray(data.tokens) ? data.tokens : [],
  };
}
