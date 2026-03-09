export interface OcrProvider {
  extractText(imagePath: string): Promise<string | null>;
}
