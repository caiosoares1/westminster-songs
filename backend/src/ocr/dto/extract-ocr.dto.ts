import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ExtractOcrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000_000)
  imageBase64: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{3}(?:\+[a-z]{3})*$/i, {
    message:
      'language must follow tesseract format, e.g. "por", "eng", or "por+eng"',
  })
  language?: string;
}
