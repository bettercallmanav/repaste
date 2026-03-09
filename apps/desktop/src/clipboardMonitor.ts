import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clipboard, nativeImage } from "electron";
import { categorize, extractMetadata } from "@clipm/shared/contentAnalyzer";
import type { ClipboardCommand } from "@clipm/contracts";

const POLL_INTERVAL_MS = 500;
const IMAGE_PREVIEW_MAX_EDGE = 720;
const IMAGE_FILE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
  ".tif",
  ".heic",
  ".heif",
  ".avif",
  ".svg",
  ".icns",
  ".ico",
]);

export type CaptureHandler = (command: ClipboardCommand) => void;

interface ClipboardMonitorOptions {
  readonly imageAssetDir: string;
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

  start(handler: CaptureHandler, options: ClipboardMonitorOptions): void {
    this.handler = handler;
    this.imageAssetDir = options.imageAssetDir;
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

    this.handler!(command);
  }

  private emitImageCapture(img: Electron.NativeImage, assetId: string): void {
    const dataUrl = this.createPreviewDataUrl(img);
    const { width, height } = img.getSize();
    const { imageAssetPath, imageMimeType } = this.persistImageAsset(img, assetId);
    const preview = `[Image ${width}x${height}]`;
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
      imageAssetId: imageAssetPath ? assetId : null,
      imageAssetPath,
      imageWidth: width,
      imageHeight: height,
      imageMimeType,
      ocrText: null,
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
    const imageFile = this.readImageFileFromClipboard();
    if (!imageFile) {
      const directImage = clipboard.readImage();
      if (!directImage.isEmpty()) {
        const hash = this.hashNativeImage(directImage);
        if (hash.length > 0) {
          return {
            key: `image:${hash}`,
            emit: () => this.emitImageCapture(directImage, hash),
          };
        }
      }
      return null;
    }

    const hash = this.hashNativeImage(imageFile);
    if (hash.length === 0) {
      return null;
    }

    return {
      key: `image-file:${hash}`,
      emit: () => this.emitImageCapture(imageFile, hash),
    };
  }

  private readImageFileFromClipboard(): Electron.NativeImage | null {
    for (const filePath of this.readClipboardFilePaths()) {
      if (!this.isImageFilePath(filePath)) {
        continue;
      }

      const image = nativeImage.createFromPath(filePath);
      if (!image.isEmpty()) {
        return image;
      }
    }

    return null;
  }

  private readClipboardFilePaths(): string[] {
    const candidates = new Set<string>();
    const formats = clipboard.availableFormats();

    this.addPathsFromRawClipboard(candidates, clipboard.readText() ?? "");

    for (const format of formats) {
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

  private isImageFilePath(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return IMAGE_FILE_EXTENSIONS.has(extension);
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
