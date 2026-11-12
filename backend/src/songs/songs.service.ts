import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSongDto } from './dto/create-song.dto';
import { SongStructureDto } from './dto/song-structure.dto';
import { UpdateSongDto } from './dto/update-song.dto';

/** Validated DTO instance -> plain JSON value for the Json column. */
function toJson(structure: SongStructureDto): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(structure)) as Prisma.InputJsonValue;
}

@Injectable()
export class SongsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSongDto) {
    return this.prisma.$transaction(async (tx) => {
      const song = await tx.song.create({
        data: {
          title: dto.title,
          originalKey: dto.originalKey,
          author: dto.author,
          category: dto.category ?? null,
        },
      });

      await tx.songVersion.create({
        data: {
          songId: song.id,
          structureJson: toJson(dto.structureJson),
        },
      });

      return tx.song.findUnique({
        where: { id: song.id },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    });
  }

  async findAll() {
    return this.prisma.song.findMany({
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!song) {
      throw new NotFoundException(`Song with ID "${id}" not found`);
    }

    return song;
  }

  async update(id: string, dto: UpdateSongDto) {
    const song = await this.prisma.song.findUnique({ where: { id } });

    if (!song) {
      throw new NotFoundException(`Song with ID "${id}" not found`);
    }

    const { structureJson, ...songData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(songData).length > 0) {
        await tx.song.update({
          where: { id },
          data: songData,
        });
      }

      if (structureJson) {
        await tx.songVersion.create({
          data: {
            songId: id,
            structureJson: toJson(structureJson),
          },
        });
      }

      return tx.song.findUnique({
        where: { id },
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    });
  }

  async remove(id: string) {
    const song = await this.prisma.song.findUnique({ where: { id } });

    if (!song) {
      throw new NotFoundException(`Song with ID "${id}" not found`);
    }

    return this.prisma.song.delete({ where: { id } });
  }
}
