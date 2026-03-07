import { clipboard } from "electron";
import { categorize, extractMetadata } from "@clipm/shared/contentAnalyzer";
import type { ClipboardCommand } from "@clipm/contracts";

const POLL_INTERVAL_MS = 500;

export type CaptureHandler = (command: ClipboardCommand) => void;

/**
 * Polls the system clipboard for changes and emits capture commands
 * when new content is detected.
 */
export class ClipboardMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastText = "";
  private lastImageHash = "";
  private handler: CaptureHandler | null = null;

  start(handler: CaptureHandler): void {
    this.handler = handler;

    // Seed with current clipboard content so we don't capture on launch
    this.lastText = clipboard.readText() ?? "";
    this.lastImageHash = this.hashImage();

    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.handler = null;
  }

  private poll(): void {
    if (!this.handler) return;

    // Text always takes priority.
    // Many apps place BOTH a text and an image representation on the clipboard
    // (browsers, rich-text editors, etc.).  If we check both independently and
    // cross-reset the "last" trackers, the monitor oscillates endlessly between
    // text and image captures (~2 events/sec), eventually OOM-crashing the
    // renderer.  Fix: when the clipboard has any text, only track text.
    // Image-only captures (e.g. screenshots) work because they have no text.
    const text = clipboard.readText() ?? "";

    if (text.length > 0) {
      if (text !== this.lastText) {
        this.lastText = text;
        this.emitTextCapture(text);
      }
      return; // ← always return when text exists, even if unchanged
    }

    // Only reach here when clipboard has NO text (e.g. screenshot)
    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      const hash = this.hashImage();
      if (hash !== this.lastImageHash && hash.length > 0) {
        this.lastImageHash = hash;
        this.emitImageCapture(img);
      }
    }
  }

  private emitTextCapture(text: string): void {
    const contentType = categorize(text);
    const metadata = extractMetadata(text, contentType);
    const preview = text.slice(0, 200);
    const now = new Date().toISOString();

    const command = {
      commandId: crypto.randomUUID(),
      type: "clip.capture",
      clipId: crypto.randomUUID(),
      content: text,
      contentType,
      category: contentType,
      preview,
      imageDataUrl: null,
      sourceApp: null,
      metadata,
      capturedAt: now,
    } as ClipboardCommand;

    this.handler!(command);
  }

  private emitImageCapture(img: Electron.NativeImage): void {
    const dataUrl = img.toDataURL();
    const preview = "[Image]";
    const now = new Date().toISOString();

    const command = {
      commandId: crypto.randomUUID(),
      type: "clip.capture",
      clipId: crypto.randomUUID(),
      content: "[Image]",
      contentType: "image" as const,
      category: "image" as const,
      preview,
      imageDataUrl: dataUrl,
      sourceApp: null,
      metadata: {
        charCount: 0,
        wordCount: 0,
        lineCount: 0,
        language: null,
        url: null,
      },
      capturedAt: now,
    } as ClipboardCommand;

    this.handler!(command);
  }

  private hashImage(): string {
    try {
      const img = clipboard.readImage();
      if (img.isEmpty()) return "";
      // Use bitmap size as a cheap hash — full pixel comparison is too expensive
      const size = img.getSize();
      const bitmap = img.toBitmap();
      return `${size.width}x${size.height}:${bitmap.length}`;
    } catch {
      return "";
    }
  }
}
