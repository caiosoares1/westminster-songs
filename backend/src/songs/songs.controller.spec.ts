import { Test, TestingModule } from '@nestjs/testing';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';

describe('SongsController', () => {
  let controller: SongsController;
  const songsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      providers: [{ provide: SongsService, useValue: songsService }],
    }).compile();

    controller = module.get(SongsController);
  });

  it('delegates to SongsService', async () => {
    songsService.findAll.mockResolvedValue([]);
    await expect(controller.findAll()).resolves.toEqual([]);

    await controller.findOne('song-1');
    expect(songsService.findOne).toHaveBeenCalledWith('song-1');
  });
});
