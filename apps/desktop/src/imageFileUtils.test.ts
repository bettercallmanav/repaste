import { describe, expect, it } from "vitest";

import {
  assetIdFromFileName,
  isAssetFileFor,
  isImageFilePath,
  mimeTypeForImagePath,
  pathsFromFilenamesPlist,
} from "./imageFileUtils.ts";

const SHA1 = "89bece4b5286fd7bd7fef3c5dc9d2bcd0eff7efe";
const OTHER_SHA1 = "0982747c15c9938a0ee220ebdb08cb9b7597c476";

describe("isAssetFileFor", () => {
  it("matches the asset regardless of stored extension", () => {
    // The bug this replaces assumed `.png` and leaked every other format.
    expect(isAssetFileFor(`${SHA1}.png`, SHA1)).toBe(true);
    expect(isAssetFileFor(`${SHA1}.heic`, SHA1)).toBe(true);
    expect(isAssetFileFor(`${SHA1}.jpeg`, SHA1)).toBe(true);
    expect(isAssetFileFor(SHA1, SHA1)).toBe(true);
  });

  it("does not match a different asset", () => {
    expect(isAssetFileFor(`${OTHER_SHA1}.png`, SHA1)).toBe(false);
  });

  it("does not match on a shared prefix without a separator", () => {
    expect(isAssetFileFor(`${SHA1}extra.png`, SHA1)).toBe(false);
  });
});

describe("assetIdFromFileName", () => {
  it("strips the extension", () => {
    expect(assetIdFromFileName(`${SHA1}.png`)).toBe(SHA1);
    expect(assetIdFromFileName(`${SHA1}.heic`)).toBe(SHA1);
  });

  it("leaves an extensionless name alone", () => {
    expect(assetIdFromFileName(SHA1)).toBe(SHA1);
  });
});

describe("isImageFilePath", () => {
  it("accepts common image extensions, case-insensitive", () => {
    expect(isImageFilePath("/tmp/photo.png")).toBe(true);
    expect(isImageFilePath("/tmp/IMG_0042.HEIC")).toBe(true);
    expect(isImageFilePath("/tmp/pic.WebP")).toBe(true);
    expect(isImageFilePath("/tmp/scan.tiff")).toBe(true);
  });

  it("rejects non-image files", () => {
    expect(isImageFilePath("/tmp/report.pdf")).toBe(false);
    expect(isImageFilePath("/tmp/archive.zip")).toBe(false);
    expect(isImageFilePath("/tmp/noextension")).toBe(false);
    expect(isImageFilePath("/tmp/video.mp4")).toBe(false);
  });
});

describe("mimeTypeForImagePath", () => {
  it("maps extensions to mime types", () => {
    expect(mimeTypeForImagePath("/a/b.png")).toBe("image/png");
    expect(mimeTypeForImagePath("/a/b.JPG")).toBe("image/jpeg");
    expect(mimeTypeForImagePath("/a/b.heic")).toBe("image/heic");
    expect(mimeTypeForImagePath("/a/b.svg")).toBe("image/svg+xml");
  });

  it("returns null for unknown extensions", () => {
    expect(mimeTypeForImagePath("/a/b.pdf")).toBeNull();
    expect(mimeTypeForImagePath("/a/b")).toBeNull();
  });
});

describe("pathsFromFilenamesPlist", () => {
  it("extracts every path from a Finder multi-select plist", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
\t<string>/Users/me/Desktop/photo.heic</string>
\t<string>/Users/me/Desktop/Q&amp;A notes.txt</string>
</array>
</plist>`;
    expect(pathsFromFilenamesPlist(xml)).toEqual([
      "/Users/me/Desktop/photo.heic",
      "/Users/me/Desktop/Q&A notes.txt",
    ]);
  });

  it("returns empty for non-plist input", () => {
    expect(pathsFromFilenamesPlist("")).toEqual([]);
    expect(pathsFromFilenamesPlist("hello")).toEqual([]);
  });
});
