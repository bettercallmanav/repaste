import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import type { OcrProvider, OcrResult } from "./OcrProvider.ts";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

export class VisionOcrProvider implements OcrProvider {
  readonly isAvailable = true;

  constructor(
    private readonly helperPath: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async extractText(imagePath: string): Promise<OcrResult> {
    if (process.platform !== "darwin") {
      return { status: "error" };
    }
    if (!existsSync(this.helperPath) || !existsSync(imagePath)) {
      return { status: "error" };
    }

    return new Promise<OcrResult>((resolve) => {
      execFile(
        this.helperPath,
        [imagePath],
        { timeout: this.timeoutMs, maxBuffer: DEFAULT_MAX_BUFFER, encoding: "utf8" },
        (error, stdout) => {
          if (error) {
            resolve({ status: "error" });
            return;
          }

          const text = stdout.trim();
          // A clean run with no recognized text is a legitimate outcome
          // (e.g. a logo or photo), distinct from an OCR failure.
          resolve(text.length > 0 ? { status: "ok", text } : { status: "empty" });
        },
      );
    });
  }
}
