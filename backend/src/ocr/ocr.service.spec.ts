import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import { recognize, TesseractNotFoundError } from './tesseract';

jest.mock('./tesseract', () => {
  const actual =
    jest.requireActual<typeof import('./tesseract')>('./tesseract');
  return { ...actual, recognize: jest.fn() };
});

const recognizeMock = recognize as jest.MockedFunction<typeof recognize>;
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);
const PNG_BASE64 = PNG_BYTES.toString('base64');

describe('OcrService', () => {
  const service = new OcrService();

  beforeEach(() => recognizeMock.mockReset());

  it('strips a data URI prefix and returns the recognized text', async () => {
    recognizeMock.mockResolvedValue('  C  G\nCastelo forte\n');

    const result = await service.extractFromBase64(
      `data:image/png;base64,${PNG_BASE64}`,
      'por',
    );

    expect(result).toEqual({ fullText: 'C  G\nCastelo forte', tokens: [] });
    expect(recognizeMock).toHaveBeenCalledWith(
      PNG_BYTES,
      expect.objectContaining({ lang: 'por', psm: 6 }),
    );
  });

  it('rejects invalid base64', async () => {
    await expect(
      service.extractFromBase64('não é base64!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it('rejects payloads that are not images, without calling tesseract', async () => {
    // Tesseract would read a non-image stdin as a list of file paths.
    const filePathList = Buffer.from('/etc/passwd\n').toString('base64');
    await expect(service.extractFromBase64(filePathList)).rejects.toThrow(
      'Unsupported image format',
    );
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it('rejects images with no recognized text', async () => {
    recognizeMock.mockResolvedValue('   \n');
    await expect(service.extractFromBase64(PNG_BASE64)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reports a missing Tesseract binary clearly', async () => {
    recognizeMock.mockRejectedValue(new TesseractNotFoundError('tesseract'));
    await expect(service.extractFromBase64(PNG_BASE64)).rejects.toThrow(
      new InternalServerErrorException(
        'Tesseract binary not available. Install Tesseract OCR on the server and try again.',
      ),
    );
  });
});
