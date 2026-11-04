import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SongsService } from './songs.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function createPrismaMock() {
  const song: Mocked<{
    create: unknown;
    findUnique: unknown;
    findMany: unknown;
    update: unknown;
    delete: unknown;
  }> = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const songVersion = { create: jest.fn() };
  const tx = { song, songVersion };

  return {
    song,
    songVersion,
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
}

describe('SongsService', () => {
  let service: SongsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const structureJson = { sections: [] };

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SongsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SongsService);
  });

  it('creates a song with its first version', async () => {
    prisma.song.create.mockResolvedValue({ id: 'song-1' });
    prisma.song.findUnique.mockResolvedValue({ id: 'song-1', versions: [] });

    await service.create({ title: 'Castelo Forte', originalKey: 'C', structureJson });

    expect(prisma.song.create).toHaveBeenCalledWith({
      data: { title: 'Castelo Forte', originalKey: 'C', author: undefined },
    });
    expect(prisma.songVersion.create).toHaveBeenCalledWith({
      data: { songId: 'song-1', structureJson },
    });
  });

  it('throws NotFoundException for an unknown song', async () => {
    prisma.song.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('missing', { title: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds a new version only when structureJson changes', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song-1' });

    await service.update('song-1', { title: 'Novo título' });
    expect(prisma.song.update).toHaveBeenCalledWith({
      where: { id: 'song-1' },
      data: { title: 'Novo título' },
    });
    expect(prisma.songVersion.create).not.toHaveBeenCalled();

    await service.update('song-1', { structureJson });
    expect(prisma.songVersion.create).toHaveBeenCalledWith({
      data: { songId: 'song-1', structureJson },
    });
  });
});
