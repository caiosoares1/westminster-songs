import { recognize, TesseractNotFoundError } from './tesseract';

describe('tesseract runner', () => {
  it('rejects unsafe arguments before spawning anything', async () => {
    await expect(
      recognize(Buffer.from(''), { lang: 'por; rm -rf /' }),
    ).rejects.toThrow('Invalid tesseract lang');
    await expect(
      recognize(Buffer.from(''), { lang: 'por', config: { a: '$(whoami)' } }),
    ).rejects.toThrow('Invalid tesseract config value');
  });

  it('reports a missing binary as TesseractNotFoundError', async () => {
    await expect(
      recognize(Buffer.from(''), {
        lang: 'por',
        binary: '/nonexistent/tesseract',
      }),
    ).rejects.toBeInstanceOf(TesseractNotFoundError);
  });
});
