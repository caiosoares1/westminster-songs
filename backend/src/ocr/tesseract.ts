import { execFile } from 'node:child_process';

export interface TesseractOptions {
  lang: string;
  oem?: number;
  psm?: number;
  /** Extra `-c key=value` config variables. */
  config?: Record<string, string>;
  binary?: string;
  timeoutMs?: number;
}

export class TesseractNotFoundError extends Error {
  constructor(binary: string) {
    super(`Tesseract binary "${binary}" not found`);
    this.name = 'TesseractNotFoundError';
  }
}

const SAFE_ARG = /^[A-Za-z0-9_+.-]+$/;

function assertSafe(name: string, value: string): void {
  if (!SAFE_ARG.test(value)) {
    throw new Error(`Invalid tesseract ${name}: ${value}`);
  }
}

/**
 * Runs the Tesseract CLI on an image buffer piped through stdin.
 *
 * Uses execFile (no shell), so arguments are never interpreted by a shell,
 * which avoids the command-injection issue of `node-tesseract-ocr`.
 */
export async function recognize(
  image: Buffer,
  options: TesseractOptions,
): Promise<string> {
  const binary = options.binary ?? process.env.TESSERACT_BIN ?? 'tesseract';

  assertSafe('lang', options.lang);
  const args = ['stdin', 'stdout', '-l', options.lang];
  if (options.oem !== undefined) args.push('--oem', String(options.oem));
  if (options.psm !== undefined) args.push('--psm', String(options.psm));
  for (const [key, value] of Object.entries(options.config ?? {})) {
    assertSafe('config key', key);
    assertSafe('config value', value);
    args.push('-c', `${key}=${value}`);
  }

  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      binary,
      args,
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: options.timeoutMs ?? 60_000,
      },
      (error, stdout, stderr) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new TesseractNotFoundError(binary));
            return;
          }
          const detail = stderr?.trim() || error.message;
          reject(new Error(detail));
          return;
        }
        resolve(stdout);
      },
    );

    child.stdin?.on('error', () => {
      // The process may exit before reading all input (e.g. invalid image);
      // the exec callback reports the real error.
    });
    child.stdin?.end(image);
  });
}
