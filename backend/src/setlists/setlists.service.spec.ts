import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SetlistsService } from './setlists.service';

function createPrismaMock() {
  return {
    setlist: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    setlistSong: {
      deleteMany: jest.fn().mockReturnValue('deleteMany'),
      createMany: jest.fn().mockReturnValue('createMany'),
    },
    song: { findMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

const SONG_A = '11111111-1111-4111-8111-111111111111';
const SONG_B = '22222222-2222-4222-8222-222222222222';

describe('SetlistsService', () => {
  let service: SetlistsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        SetlistsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SetlistsService);
  });

  it('lists setlists with a song count', async () => {
    prisma.setlist.findMany.mockResolvedValue([
      { id: 's1', name: 'Culto', _count: { songs: 3 } },
    ]);

    await expect(service.findAll()).resolves.toEqual([
      { id: 's1', name: 'Culto', songCount: 3 },
    ]);
  });

  it('creates with a trimmed name and parsed date', async () => {
    await service.create({ name: '  Culto de Domingo ', date: '2026-11-08' });

    expect(prisma.setlist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Culto de Domingo', date: new Date('2026-11-08') },
      }),
    );
  });

  it('clears the date when updating with null', async () => {
    prisma.setlist.findUnique.mockResolvedValue({ id: 's1' });

    await service.update('s1', { date: null });

    expect(prisma.setlist.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: undefined, date: null } }),
    );
  });

  it('throws NotFoundException for an unknown setlist', async () => {
    prisma.setlist.findUnique.mockResolvedValue(null);

    await expect(service.findOne('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.replaceSongs('x', { items: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces the songs keeping the given order and keys', async () => {
    prisma.setlist.findUnique.mockResolvedValue({ id: 's1', songs: [] });
    prisma.song.findMany.mockResolvedValue([{ id: SONG_A }, { id: SONG_B }]);

    await service.replaceSongs('s1', {
      items: [
        { songId: SONG_B, key: 'D' },
        { songId: SONG_A, key: 'Bb' },
      ],
    });

    expect(prisma.setlistSong.deleteMany).toHaveBeenCalledWith({
      where: { setlistId: 's1' },
    });
    expect(prisma.setlistSong.createMany).toHaveBeenCalledWith({
      data: [
        { setlistId: 's1', songId: SONG_B, key: 'D', position: 0 },
        { setlistId: 's1', songId: SONG_A, key: 'Bb', position: 1 },
      ],
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'deleteMany',
      'createMany',
    ]);
  });

  it('rejects unknown songs without touching the setlist', async () => {
    prisma.setlist.findUnique.mockResolvedValue({ id: 's1', songs: [] });
    prisma.song.findMany.mockResolvedValue([{ id: SONG_A }]);

    await expect(
      service.replaceSongs('s1', {
        items: [
          { songId: SONG_A, key: 'C' },
          { songId: SONG_B, key: 'C' },
        ],
      }),
    ).rejects.toThrow(new BadRequestException(`Unknown song IDs: ${SONG_B}`));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
