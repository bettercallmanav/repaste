import type { OcrProvider, OcrResult } from "./OcrProvider.ts";

export class NoopOcrProvider implements OcrProvider {
  readonly isAvailable = false;

  async extractText(_imagePath: string): Promise<OcrResult> {
    return { status: "error" };
  }
}
