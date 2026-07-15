import { describe, expect, it } from "vitest";

import { isImageFilePath, mimeTypeForImagePath, pathsFromFilenamesPlist } from "./imageFileUtils.ts";

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
