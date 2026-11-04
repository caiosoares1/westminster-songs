import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSetlistDto,
  ReplaceSetlistSongsDto,
  UpdateSetlistDto,
} from './dto/setlist.dto';

const SONG_SUMMARY = {
  select: { id: true, title: true, author: true, originalKey: true },
} as const;

const SETLIST_DETAIL = {
  songs: {
    orderBy: { position: 'asc' },
    select: { id: true, key: true, position: true, song: SONG_SUMMARY },
  },
} as const;

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

@Injectable()
export class SetlistsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const setlists = await this.prisma.setlist.findMany({
      // Upcoming/most recent services first, undated ones after.
      orderBy: [
        { date: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      include: { _count: { select: { songs: true } } },
    });

    return setlists.map(({ _count, ...setlist }) => ({
      ...setlist,
      songCount: _count.songs,
    }));
  }

  async findOne(id: string) {
    const setlist = await this.prisma.setlist.findUnique({
      where: { id },
      include: SETLIST_DETAIL,
    });

    if (!setlist) {
      throw new NotFoundException(`Setlist with ID "${id}" not found`);
    }

    return setlist;
  }

  async create(dto: CreateSetlistDto) {
    return this.prisma.setlist.create({
      data: { name: dto.name.trim(), date: toDate(dto.date) },
      include: SETLIST_DETAIL,
    });
  }

  async update(id: string, dto: UpdateSetlistDto) {
    await this.findOne(id);

    return this.prisma.setlist.update({
      where: { id },
      data: { name: dto.name?.trim(), date: toDate(dto.date) },
      include: SETLIST_DETAIL,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.setlist.delete({ where: { id } });
  }

  /** Replaces the ordered song list (add, remove, reorder and key changes). */
  async replaceSongs(id: string, dto: ReplaceSetlistSongsDto) {
    await this.findOne(id);

    const songIds = [...new Set(dto.items.map((item) => item.songId))];
    const existing = await this.prisma.song.findMany({
      where: { id: { in: songIds } },
      select: { id: true },
    });
    const missing = songIds.filter(
      (songId) => !existing.some((song) => song.id === songId),
    );
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown song IDs: ${missing.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.setlistSong.deleteMany({ where: { setlistId: id } }),
      this.prisma.setlistSong.createMany({
        data: dto.items.map((item, position) => ({
          setlistId: id,
          songId: item.songId,
          key: item.key,
          position,
        })),
      }),
    ]);

    return this.findOne(id);
  }
}
