export interface OcrProvider {
  readonly isAvailable: boolean;
  extractText(imagePath: string): Promise<string | null>;
}
