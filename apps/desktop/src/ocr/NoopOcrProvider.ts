import type { OcrProvider } from "./OcrProvider.ts";

export class NoopOcrProvider implements OcrProvider {
  async extractText(_imagePath: string): Promise<string | null> {
    return null;
  }
}
