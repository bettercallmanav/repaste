import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clipboard, nativeImage } from "electron";
import { categorize, extractMetadata } from "@clipm/shared/contentAnalyzer";
import type { ClipboardCommand } from "@clipm/contracts";
import { isImageFilePath, mimeTypeForImagePath, pathsFromFilenamesPlist } from "./imageFileUtils.ts";
import type { OcrProvider } from "./ocr/OcrProvider.ts";

const POLL_INTERVAL_MS = 500;
const IMAGE_PREVIEW_MAX_EDGE = 720;

export type CaptureHandler = (command: ClipboardCommand) => void | Promise<void>;

interface ClipboardMonitorOptions {
  readonly imageAssetDir: string;
  readonly ocrProvider: OcrProvider;
}

interface ClipboardSnapshot {
  readonly key: string;
  readonly emit: () => void;
}

/**
 * Polls the system clipboard for changes and emits capture commands
 * when new content is detected.
 */
export class ClipboardMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSnapshotKey = "";
  private handler: CaptureHandler | null = null;
  private imageAssetDir: string | null = null;
  private ocrProvider: OcrProvider | null = null;
  private ocrEnabled = true;

  start(handler: CaptureHandler, options: ClipboardMonitorOptions): void {
    this.handler = handler;
    this.imageAssetDir = options.imageAssetDir;
    this.ocrProvider = options.ocrProvider;
    this.ocrEnabled = true;
    mkdirSync(this.imageAssetDir, { recursive: true });

    // Seed with current clipboard content so we don't capture on launch
    this.lastSnapshotKey = this.readSnapshot()?.key ?? "";

    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.handler = null;
    this.imageAssetDir = null;
    this.ocrProvider = null;
    this.ocrEnabled = true;
  }

  setOcrEnabled(enabled: boolean): void {
    this.ocrEnabled = enabled;
  }

  private poll(): void {
    if (!this.handler) return;
    const snapshot = this.readSnapshot();
    const nextKey = snapshot?.key ?? "";
    if (nextKey === this.lastSnapshotKey) {
      return;
    }

    this.lastSnapshotKey = nextKey;
    snapshot?.emit();
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

    void this.handler?.(command);
  }

  private async emitImageCapture(img: Electron.NativeImage, assetId: string): Promise<void> {
    const handler = this.handler;
    if (!handler) {
      return;
    }

    const dataUrl = this.createPreviewDataUrl(img);
    const { width, height } = img.getSize();
    const { imageAssetPath, imageMimeType } = this.persistImageAsset(img, assetId);
    const preview = `[Image ${width}x${height}]`;
    const now = new Date().toISOString();
    const clipId = crypto.randomUUID();

    const ocrAvailable = this.ocrEnabled && (this.ocrProvider?.isAvailable ?? false);

    const command = {
      commandId: crypto.randomUUID(),
      type: "clip.capture",
      clipId,
      content: "[Image]",
      contentType: "image" as const,
      category: "image" as const,
      preview,
      imageDataUrl: dataUrl,
      imageAssetId: imageAssetPath ? assetId : null,
      imageAssetPath,
      imageWidth: width,
      imageHeight: height,
      imageMimeType,
      ocrText: null,
      ocrStatus: imageAssetPath && ocrAvailable ? "pending" as const : "skipped" as const,
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

    await Promise.resolve(handler(command));

    if (!imageAssetPath || !this.ocrProvider || !ocrAvailable) {
      return;
    }

    await this.runOcrForCapture(handler, clipId, imageAssetPath);
  }

  private async runOcrForCapture(
    handler: CaptureHandler,
    clipId: string,
    imageAssetPath: string,
  ): Promise<void> {
    if (!this.ocrProvider) return;

    try {
      const result = await this.ocrProvider.extractText(imageAssetPath);
      if (result.status === "ok") {
        await Promise.resolve(handler({
          commandId: crypto.randomUUID(),
          type: "clip.updateOcr",
          clipId,
          ocrText: result.text,
          updatedAt: new Date().toISOString(),
        } as ClipboardCommand));
      } else {
        await Promise.resolve(handler({
          commandId: crypto.randomUUID(),
          type: "clip.updateOcrStatus",
          clipId,
          // No recognizable text is "skipped"; only real errors are "failed".
          ocrStatus: result.status === "empty" ? "skipped" : "failed",
          updatedAt: new Date().toISOString(),
        } as ClipboardCommand));
      }
    } catch {
      // OCR is best-effort — dispatch failed status but don't crash.
      try {
        await Promise.resolve(handler({
          commandId: crypto.randomUUID(),
          type: "clip.updateOcrStatus",
          clipId,
          ocrStatus: "failed",
          updatedAt: new Date().toISOString(),
        } as ClipboardCommand));
      } catch {
        // Completely silenced — handler may be gone if monitor stopped.
      }
    }
  }

  /**
   * Capture a single image FILE copied in Finder. The original bytes are
   * stored as the asset (no PNG re-encode — Vision OCR reads the original
   * directly); the preview comes from a direct decode when possible
   * (png/jpeg) or the OS thumbnailer (QuickLook) for every other format.
   * If neither can render it, the copy is ignored entirely.
   */
  private async emitImageFileCapture(filePath: string): Promise<void> {
    const handler = this.handler;
    if (!handler || !this.imageAssetDir) return;

    let bytes: Buffer;
    try {
      bytes = readFileSync(filePath);
    } catch {
      return;
    }

    const assetId = createHash("sha1").update(bytes).digest("hex");
    const extension = path.extname(filePath).toLowerCase();
    const imageMimeType = mimeTypeForImagePath(filePath);

    let imageAssetPath: string | null = null;
    try {
      imageAssetPath = path.join(this.imageAssetDir, `${assetId}${extension}`);
      if (!existsSync(imageAssetPath)) {
        writeFileSync(imageAssetPath, bytes);
      }
    } catch {
      imageAssetPath = null;
    }

    // Preview: direct decode covers png/jpeg; QuickLook covers the rest
    // (heic, webp, tiff, …). Thumbnail dimensions are capped at the
    // preview edge, so they may be smaller than the original's.
    let previewImage = nativeImage.createFromPath(filePath);
    const exactSize = !previewImage.isEmpty();
    if (previewImage.isEmpty()) {
      try {
        previewImage = await nativeImage.createThumbnailFromPath(filePath, {
          width: IMAGE_PREVIEW_MAX_EDGE,
          height: IMAGE_PREVIEW_MAX_EDGE,
        });
      } catch {
        // Unsupported or unreadable — ignored below.
      }
    }
    if (previewImage.isEmpty()) return;

    const { width, height } = previewImage.getSize();
    const dataUrl = this.createPreviewDataUrl(previewImage);
    const now = new Date().toISOString();
    const clipId = crypto.randomUUID();
    const ocrAvailable = this.ocrEnabled && (this.ocrProvider?.isAvailable ?? false);

    const command = {
      commandId: crypto.randomUUID(),
      type: "clip.capture",
      clipId,
      content: "[Image]",
      contentType: "image" as const,
      category: "image" as const,
      preview: exactSize ? `[Image ${width}x${height}]` : "[Image]",
      imageDataUrl: dataUrl,
      imageAssetId: imageAssetPath ? assetId : null,
      imageAssetPath,
      imageWidth: width,
      imageHeight: height,
      imageMimeType,
      ocrText: null,
      ocrStatus: imageAssetPath && ocrAvailable ? "pending" as const : "skipped" as const,
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

    await Promise.resolve(handler(command));

    if (!imageAssetPath || !this.ocrProvider || !ocrAvailable) return;
    await this.runOcrForCapture(handler, clipId, imageAssetPath);
  }

  private hashNativeImage(img: Electron.NativeImage): string {
    const bitmap = img.toBitmap();
    return createHash("sha1").update(bitmap).digest("hex");
  }

  private readSnapshot(): ClipboardSnapshot | null {
    const imageSnapshot = this.readImageSnapshot();
    if (imageSnapshot) {
      return imageSnapshot;
    }

    const text = clipboard.readText() ?? "";
    if (text.length === 0) {
      return null;
    }

    return {
      key: `text:${text}`,
      emit: () => this.emitTextCapture(text),
    };
  }

  private readImageSnapshot(): ClipboardSnapshot | null {
    const filePaths = this.readClipboardFilePaths();
    if (filePaths.length > 0) {
      // File copies: process exactly ONE image file. Everything else —
      // non-image files (PDFs etc.) and multi-file selections — is
      // deliberately ignored. Never fall through to clipboard.readImage():
      // macOS also puts the Finder ICON on the pasteboard for file copies,
      // which is the empty/fallback image users were seeing.
      const first = filePaths[0]!;
      if (filePaths.length === 1 && isImageFilePath(first)) {
        const key = this.imageFileSnapshotKey(first);
        if (key) {
          return {
            key,
            emit: () => { void this.emitImageFileCapture(first); },
          };
        }
      }
      return {
        key: `files:${createHash("sha1").update(filePaths.join("\n")).digest("hex")}`,
        emit: () => {},
      };
    }

    const directImage = clipboard.readImage();
    if (!directImage.isEmpty()) {
      const hash = this.hashNativeImage(directImage);
      if (hash.length > 0) {
        return {
          key: `image:${hash}`,
          emit: () => { void this.emitImageCapture(directImage, hash); },
        };
      }
    }
    return null;
  }

  /** Cheap change-detection key for a file on the clipboard: no decoding
   *  or content hashing in the 500ms poll loop. */
  private imageFileSnapshotKey(filePath: string): string | null {
    try {
      const stats = statSync(filePath);
      return `image-file:${filePath}:${stats.mtimeMs}:${stats.size}`;
    } catch {
      return null;
    }
  }

  private readClipboardFilePaths(): string[] {
    const candidates = new Set<string>();

    // macOS puts file copies on the raw NSPasteboard types. Note that
    // readBuffer("text/uri-list") returns an EMPTY string on macOS
    // (Electron quirk), so clipboard.read() on these types is the only
    // reliable source. NSFilenamesPboardType lists EVERY file of a
    // multi-select, which lets us detect selections we ignore.
    try {
      this.addPathsFromRawClipboard(candidates, clipboard.read("public.file-url") ?? "");
    } catch {
      // Format unavailable on this platform/clipboard.
    }
    try {
      for (const plistPath of pathsFromFilenamesPlist(clipboard.read("NSFilenamesPboardType") ?? "")) {
        const resolvedPath = this.resolveClipboardPath(plistPath);
        if (resolvedPath) {
          candidates.add(resolvedPath);
        }
      }
    } catch {
      // Format unavailable on this platform/clipboard.
    }

    this.addPathsFromRawClipboard(candidates, clipboard.readText() ?? "");

    for (const format of clipboard.availableFormats()) {
      const normalizedFormat = format.toLowerCase();
      if (!normalizedFormat.includes("file") && !normalizedFormat.includes("uri")) {
        continue;
      }

      try {
        const raw = clipboard.readBuffer(format).toString("utf8");
        this.addPathsFromRawClipboard(candidates, raw);
      } catch {
        // Ignore clipboard formats that can't be decoded as UTF-8 text.
      }
    }

    return [...candidates];
  }

  private addPathsFromRawClipboard(target: Set<string>, raw: string): void {
    if (raw.length === 0) {
      return;
    }

    const normalizedRaw = raw.replace(/\0/g, "\n");
    const fileUrlMatches = normalizedRaw.match(/file:\/\/[^\r\n]+/g) ?? [];
    for (const match of fileUrlMatches) {
      const resolvedPath = this.resolveClipboardPath(match);
      if (resolvedPath) {
        target.add(resolvedPath);
      }
    }

    for (const part of normalizedRaw.split(/\r?\n/)) {
      const resolvedPath = this.resolveClipboardPath(part);
      if (resolvedPath) {
        target.add(resolvedPath);
      }
    }
  }

  private resolveClipboardPath(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (trimmed.startsWith("file://")) {
      try {
        const filePath = fileURLToPath(trimmed);
        return existsSync(filePath) ? filePath : null;
      } catch {
        return null;
      }
    }

    return existsSync(trimmed) ? trimmed : null;
  }

  private persistImageAsset(
    img: Electron.NativeImage,
    assetId: string,
  ): { imageAssetPath: string | null; imageMimeType: string | null } {
    if (!this.imageAssetDir) {
      return { imageAssetPath: null, imageMimeType: null };
    }

    try {
      const imageAssetPath = path.join(this.imageAssetDir, `${assetId}.png`);
      if (!existsSync(imageAssetPath)) {
        writeFileSync(imageAssetPath, img.toPNG());
      }
      return { imageAssetPath, imageMimeType: "image/png" };
    } catch {
      return { imageAssetPath: null, imageMimeType: null };
    }
  }

  private createPreviewDataUrl(img: Electron.NativeImage): string {
    const { width, height } = img.getSize();
    const maxEdge = Math.max(width, height);
    if (maxEdge <= IMAGE_PREVIEW_MAX_EDGE) {
      return img.toDataURL();
    }

    const scale = IMAGE_PREVIEW_MAX_EDGE / maxEdge;
    const resized = img.resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    });
    return resized.toDataURL();
  }
}
