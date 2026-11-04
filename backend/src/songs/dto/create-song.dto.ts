import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SONG_KEY_REGEX, SongStructureDto } from './song-structure.dto';

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @Matches(SONG_KEY_REGEX, {
    message: 'originalKey must be a key like "C", "F#", "Bb" or "Am"',
  })
  originalKey: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  author?: string;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => SongStructureDto)
  structureJson: SongStructureDto;
}
