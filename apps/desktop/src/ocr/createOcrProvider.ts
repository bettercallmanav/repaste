import { existsSync } from "node:fs";
import { NoopOcrProvider } from "./NoopOcrProvider.ts";
import type { OcrProvider } from "./OcrProvider.ts";
import { VisionOcrProvider } from "./VisionOcrProvider.ts";

interface CreateOcrProviderOptions {
  readonly helperPath: string;
}

export function createOcrProvider(options: CreateOcrProviderOptions): OcrProvider {
  if (process.platform !== "darwin") {
    return new NoopOcrProvider();
  }

  if (!existsSync(options.helperPath)) {
    console.warn(`[ocr] Vision helper not found at ${options.helperPath}; OCR disabled`);
    return new NoopOcrProvider();
  }

  return new VisionOcrProvider(options.helperPath);
}
