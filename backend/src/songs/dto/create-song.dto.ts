import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SONG_KEY_REGEX, SongStructureDto } from './song-structure.dto';

export const SONG_CATEGORIES = ['hymn', 'psalm', 'canticle'] as const;
export type SongCategory = (typeof SONG_CATEGORIES)[number];

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

  /** Hinário, salmo or cântico; null clears it. */
  @IsOptional()
  @IsIn(SONG_CATEGORIES, {
    message: 'category must be hymn, psalm or canticle',
  })
  category?: SongCategory | null;

  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => SongStructureDto)
  structureJson: SongStructureDto;
}
