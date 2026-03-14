import { Body, Controller, Post } from '@nestjs/common';
import { ExtractOcrDto } from './dto/extract-ocr.dto';
import { OcrService, type OcrExtractResponse } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('extract')
  extract(@Body() body: ExtractOcrDto): Promise<OcrExtractResponse> {
    return this.ocrService.extractFromBase64(body.imageBase64, body.language);
  }
}
