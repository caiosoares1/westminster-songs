import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** A song key: root, optional accidental and optional minor, e.g. C, F#, Bb, Am. */
export const SONG_KEY_REGEX = /^[A-G](#|b)?m?$/;

export class SongItemDto {
  @IsIn(['chord', 'lyric'])
  type: 'chord' | 'lyric';

  @IsString()
  @MaxLength(500)
  value: string;
}

export class SongLineDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SongItemDto)
  items: SongItemDto[];
}

export class SongSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SongLineDto)
  lines: SongLineDto[];
}

/** Shape the mobile app renders: sections -> lines -> chord/lyric items. */
export class SongStructureDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SongSectionDto)
  sections: SongSectionDto[];
}
