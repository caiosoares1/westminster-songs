declare module 'node-tesseract-ocr' {
  export interface TesseractConfig {
    lang?: string;
    oem?: number;
    psm?: number;
    preserve_interword_spaces?: string;
    [key: string]: string | number | undefined;
  }

  export function recognize(image: Buffer | string, config?: TesseractConfig): Promise<string>;

  const tesseract: {
    recognize: typeof recognize;
  };

  export default tesseract;
}
