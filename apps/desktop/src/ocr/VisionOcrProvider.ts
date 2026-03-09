import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import type { OcrProvider } from "./OcrProvider.ts";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

export class VisionOcrProvider implements OcrProvider {
  constructor(
    private readonly helperPath: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async extractText(imagePath: string): Promise<string | null> {
    if (process.platform !== "darwin") {
      return null;
    }
    if (!existsSync(this.helperPath) || !existsSync(imagePath)) {
      return null;
    }

    return new Promise<string | null>((resolve) => {
      execFile(
        this.helperPath,
        [imagePath],
        { timeout: this.timeoutMs, maxBuffer: DEFAULT_MAX_BUFFER, encoding: "utf8" },
        (error, stdout) => {
          if (error) {
            resolve(null);
            return;
          }

          const text = stdout.trim();
          resolve(text.length > 0 ? text : null);
        },
      );
    });
  }
}
