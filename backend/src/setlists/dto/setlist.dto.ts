import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { SONG_KEY_REGEX } from '../../songs/dto/song-structure.dto';

export class CreateSetlistDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** Service date (YYYY-MM-DD or full ISO). `null` clears it on update. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  date?: string | null;
}

export class UpdateSetlistDto extends PartialType(CreateSetlistDto) {}

export class SetlistSongItemDto {
  @IsUUID()
  songId: string;

  /** Key the song is played in this setlist. */
  @IsString()
  @Matches(SONG_KEY_REGEX, {
    message: 'key must be a key like "C", "F#", "Bb" or "Am"',
  })
  key: string;
}

/** The full ordered list of songs; replaces the current one. */
export class ReplaceSetlistSongsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SetlistSongItemDto)
  items: SetlistSongItemDto[];
}
