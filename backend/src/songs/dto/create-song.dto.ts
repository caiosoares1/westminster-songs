import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  originalKey: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsObject()
  @IsNotEmpty()
  structureJson: object;
}
