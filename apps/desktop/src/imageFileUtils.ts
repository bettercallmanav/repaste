import path from "node:path";

export const IMAGE_FILE_EXTENSIONS = new Set([
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

const MIME_BY_EXTENSION: Record<string, string> = {
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

export function isImageFilePath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return IMAGE_FILE_EXTENSIONS.has(extension);
}

export function mimeTypeForImagePath(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? null;
}

/**
 * Extract file paths from macOS's NSFilenamesPboardType plist XML — the
 * pasteboard type that lists EVERY file in a Finder copy (multi-select
 * included), which is how we distinguish single-image copies from
 * selections we deliberately ignore.
 */
export function pathsFromFilenamesPlist(xml: string): string[] {
  if (!xml.includes("<plist")) return [];
  const matches = xml.match(/<string>([\s\S]*?)<\/string>/g) ?? [];
  return matches.map((entry) =>
    entry
      .slice("<string>".length, -"</string>".length)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, "&"),
  );
}
