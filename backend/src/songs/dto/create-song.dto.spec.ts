import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateSongDto } from './create-song.dto';
import { UpdateSongDto } from './update-song.dto';

// Same options as main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validate = (body: unknown, metatype: new () => object = CreateSongDto) =>
  pipe.transform(body, { type: 'body', metatype });

const structureJson = {
  sections: [
    {
      type: 'verse 1',
      lines: [
        {
          items: [
            { type: 'chord', value: 'C' },
            { type: 'lyric', value: 'Castelo forte' },
          ],
        },
      ],
    },
  ],
};

describe('CreateSongDto validation', () => {
  it('accepts a valid song', async () => {
    await expect(
      validate({ title: 'Castelo Forte', originalKey: 'C', structureJson }),
    ).resolves.toBeInstanceOf(CreateSongDto);
  });

  it('accepts the song type and rejects unknown ones', async () => {
    await expect(
      validate({
        title: 'Salmo 16b',
        originalKey: 'C',
        category: 'psalm',
        structureJson,
      }),
    ).resolves.toBeInstanceOf(CreateSongDto);
    await expect(
      validate({ category: null }, UpdateSongDto),
    ).resolves.toBeInstanceOf(UpdateSongDto);
    await expect(
      validate({
        title: 'X',
        originalKey: 'C',
        category: 'rock',
        structureJson,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['structure without sections', { foo: 1 }],
    [
      'unknown item type',
      {
        sections: [
          { type: 'verse', lines: [{ items: [{ type: 'x', value: 'C' }] }] },
        ],
      },
    ],
    [
      'non-string item value',
      {
        sections: [
          { type: 'verse', lines: [{ items: [{ type: 'chord', value: 7 }] }] },
        ],
      },
    ],
    ['extra fields inside the structure', { sections: [], hacked: true }],
  ])('rejects %s', async (_name, badStructure) => {
    await expect(
      validate({ title: 'x', originalKey: 'C', structureJson: badStructure }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['Zzz', 'c', 'Dó', 'H', 'C7'])(
    'rejects key %p',
    async (originalKey) => {
      await expect(
        validate({ title: 'x', originalKey, structureJson }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['C', 'F#', 'Bb', 'Am', 'C#m', 'Ebm'])(
    'accepts key %p',
    async (originalKey) => {
      await expect(
        validate({ title: 'x', originalKey, structureJson }),
      ).resolves.toBeDefined();
    },
  );

  it('validates the structure on update too', async () => {
    await expect(
      validate({ title: 'Novo' }, UpdateSongDto),
    ).resolves.toBeDefined();
    await expect(
      validate({ structureJson: { foo: 1 } }, UpdateSongDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
