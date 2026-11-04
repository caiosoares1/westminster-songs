import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { recognize, TesseractNotFoundError } from './tesseract';

export interface OcrToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrExtractResponse {
  fullText: string;
  tokens: OcrToken[];
}

function normalizeBase64Payload(base64Input: string): string {
  const trimmedInput = base64Input.trim();
  if (!trimmedInput) {
    throw new BadRequestException('imageBase64 is empty');
  }

  const dataUriPrefixMatch = trimmedInput.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,/);
  if (dataUriPrefixMatch) {
    return trimmedInput.slice(dataUriPrefixMatch[0].length);
  }

  return trimmedInput;
}

function isLikelyBase64Payload(value: string): boolean {
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

@Injectable()
export class OcrService {
  private readonly defaultLanguage = process.env.OCR_DEFAULT_LANG ?? 'por+eng';

  async extractFromBase64(imageBase64: string, language?: string): Promise<OcrExtractResponse> {
    const normalizedBase64 = normalizeBase64Payload(imageBase64).replace(/\s+/g, '');
    if (!isLikelyBase64Payload(normalizedBase64)) {
      throw new BadRequestException('Invalid imageBase64 payload');
    }

    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(normalizedBase64, 'base64');
    } catch {
      throw new BadRequestException('Invalid imageBase64 payload');
    }

    if (imageBuffer.length === 0) {
      throw new BadRequestException('Invalid imageBase64 payload');
    }

    try {
      const fullText = await recognize(imageBuffer, {
        lang: (language ?? this.defaultLanguage).toLowerCase(),
        oem: 1,
        psm: 6,
        config: { preserve_interword_spaces: '1' },
      });

      const trimmedText = fullText.trim();
      if (!trimmedText) {
        throw new BadRequestException('No text recognized from image');
      }

      return {
        fullText: trimmedText,
        tokens: [],
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof TesseractNotFoundError) {
        throw new InternalServerErrorException(
          'Tesseract binary not available. Install Tesseract OCR on the server and try again.'
        );
      }

      const message = error instanceof Error ? error.message : 'Unknown OCR error';

      throw new InternalServerErrorException(`OCR failed: ${message}`);
    }
  }
}
