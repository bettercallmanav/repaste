import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clipboard, nativeImage } from "electron";
import { categorize, extractMetadata } from "@clipm/shared/contentAnalyzer";
import type { ClipboardCommand } from "@clipm/contracts";
import type { OcrProvider } from "./ocr/OcrProvider.ts";

const POLL_INTERVAL_MS = 200;
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
const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".icns": "image/icns",
  ".ico": "image/x-icon",
};

export type CaptureHandler = (command: ClipboardCommand) => void | Promise<void>;

interface ClipboardMonitorOptions {
  readonly imageAssetDir: string;
  readonly ocrProvider: OcrProvider;
}

interface ClipboardSnapshot {
  readonly key: string;
  readonly emit: () => void;
}

interface ImageSnapshot {
  readonly image: Electron.NativeImage;
  readonly key: string;
  readonly sourceFilePath: string | null;
  readonly assetId: string;
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

  private async emitImageCapture(
    img: Electron.NativeImage,
    assetId: string,
    sourceFilePath: string | null = null,
  ): Promise<void> {
    const handler = this.handler;
    if (!handler) {
      return;
    }

    const dataUrl = this.createPreviewDataUrl(img);
    const { width, height } = img.getSize();
    const { imageAssetPath, imageMimeType } = this.persistImageAsset(img, assetId, sourceFilePath);
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

    const filenameTag = this.getFilenameTag(sourceFilePath);
    if (filenameTag) {
      await Promise.resolve(handler({
        commandId: crypto.randomUUID(),
        type: "clip.tag",
        clipId,
        tag: filenameTag,
      } as ClipboardCommand));
    }

    if (!imageAssetPath || !this.ocrProvider || !ocrAvailable) {
      return;
    }

    try {
      const ocrText = await this.ocrProvider.extractText(imageAssetPath);
      if (ocrText) {
        await Promise.resolve(handler({
          commandId: crypto.randomUUID(),
          type: "clip.updateOcr",
          clipId,
          ocrText,
          updatedAt: new Date().toISOString(),
        } as ClipboardCommand));
      } else {
        await Promise.resolve(handler({
          commandId: crypto.randomUUID(),
          type: "clip.updateOcrStatus",
          clipId,
          ocrStatus: "failed",
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
    const hasFileLikeFormats = this.hasClipboardFileFormats();
    const imageFile = this.readImageFileFromClipboard();
    if (!imageFile) {
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
      if (hasFileLikeFormats) {
        return null;
      }
      return null;
    }

    const hash = this.hashNativeImage(imageFile.image);
    if (hash.length === 0) {
      return null;
    }

    return {
      key: imageFile.key,
      emit: () => { void this.emitImageCapture(imageFile.image, imageFile.assetId, imageFile.sourceFilePath); },
    };
  }

  private readImageFileFromClipboard(): ImageSnapshot | null {
    for (const filePath of this.readClipboardFilePaths()) {
      if (!this.isImageFilePath(filePath)) {
        continue;
      }

      const image = this.readImageFromFilePath(filePath);
      if (!image.isEmpty()) {
        const assetId = this.hashFilePath(filePath) ?? this.hashNativeImage(image);
        const fileKey = this.getFileSnapshotKey(filePath) ?? `image-file:${assetId}`;
        return {
          image,
          key: fileKey,
          sourceFilePath: filePath,
          assetId,
        };
      }
    }

    return null;
  }

  private hasClipboardFileFormats(): boolean {
    return clipboard.availableFormats().some((format) => {
      const normalizedFormat = format.toLowerCase();
      return normalizedFormat.includes("file") || normalizedFormat.includes("uri");
    });
  }

  private getFilenameTag(sourceFilePath: string | null): string | null {
    if (!sourceFilePath) {
      return null;
    }

    const extension = path.extname(sourceFilePath);
    const filename = path.basename(sourceFilePath, extension).trim();
    if (filename.length === 0) {
      return null;
    }

    return filename.slice(0, 80);
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
        const buffer = clipboard.readBuffer(format);
        this.addPathsFromPlistBuffer(candidates, buffer);
        this.addPathsFromBuffer(candidates, buffer);
      } catch {
        // Ignore clipboard formats that can't be decoded as UTF-8 text.
      }
    }

    return [...candidates];
  }

  private addPathsFromBuffer(target: Set<string>, buffer: Buffer): void {
    const textCandidates = new Set<string>();

    try {
      textCandidates.add(buffer.toString("utf8"));
    } catch {
      // Ignore invalid UTF-8.
    }

    try {
      textCandidates.add(buffer.toString("utf16le"));
    } catch {
      // Ignore invalid UTF-16.
    }

    for (const text of textCandidates) {
      this.addPathsFromRawClipboard(target, text);
    }
  }

  private addPathsFromPlistBuffer(target: Set<string>, buffer: Buffer): void {
    try {
      const result = spawnSync(
        "plutil",
        ["-convert", "json", "-o", "-", "-"],
        {
          input: buffer,
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        },
      );

      if (result.status !== 0 || !result.stdout) {
        return;
      }

      for (const text of this.extractStringsFromUnknownJson(JSON.parse(result.stdout) as unknown)) {
        this.addPathsFromRawClipboard(target, text);
      }
    } catch {
      // Not a property list payload.
    }
  }

  private extractStringsFromUnknownJson(value: unknown): string[] {
    if (typeof value === "string") {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.extractStringsFromUnknownJson(entry));
    }

    if (value && typeof value === "object") {
      return Object.values(value).flatMap((entry) => this.extractStringsFromUnknownJson(entry));
    }

    return [];
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

    const absolutePathMatches = normalizedRaw.match(/\/Users\/[^\r\n]+\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif|svg|icns|ico)/gi) ?? [];
    for (const match of absolutePathMatches) {
      const resolvedPath = this.resolveClipboardPath(match);
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

  private readImageFromFilePath(filePath: string): Electron.NativeImage {
    try {
      const image = nativeImage.createFromBuffer(readFileSync(filePath));
      if (!image.isEmpty()) {
        return image;
      }
    } catch {
      // Fall back to createFromPath below.
    }

    return nativeImage.createFromPath(filePath);
  }

  private hashFilePath(filePath: string): string | null {
    try {
      return createHash("sha1").update(readFileSync(filePath)).digest("hex");
    } catch {
      return null;
    }
  }

  private getFileSnapshotKey(filePath: string): string | null {
    try {
      const stats = statSync(filePath);
      return `image-file:${filePath}:${stats.size}:${stats.mtimeMs}`;
    } catch {
      return null;
    }
  }

  private persistImageAsset(
    img: Electron.NativeImage,
    assetId: string,
    sourceFilePath: string | null = null,
  ): { imageAssetPath: string | null; imageMimeType: string | null } {
    if (!this.imageAssetDir) {
      return { imageAssetPath: null, imageMimeType: null };
    }

    try {
      if (sourceFilePath && existsSync(sourceFilePath)) {
        const extension = path.extname(sourceFilePath).toLowerCase();
        const imageAssetPath = path.join(
          this.imageAssetDir,
          `${assetId}${IMAGE_FILE_EXTENSIONS.has(extension) ? extension : ".png"}`,
        );
        if (!existsSync(imageAssetPath)) {
          writeFileSync(imageAssetPath, readFileSync(sourceFilePath));
        }
        return {
          imageAssetPath,
          imageMimeType: IMAGE_MIME_TYPES[extension] ?? "application/octet-stream",
        };
      }

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
