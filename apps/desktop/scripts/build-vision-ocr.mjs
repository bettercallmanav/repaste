import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, "..");
const sourcePath = path.join(desktopDir, "src", "ocr", "vision-ocr.swift");
const outputDir = path.join(desktopDir, "build", "bin");
const outputPath = path.join(outputDir, "vision-ocr");
const moduleCachePath = path.join(desktopDir, "build", ".swift-module-cache");

mkdirSync(outputDir, { recursive: true });
mkdirSync(moduleCachePath, { recursive: true });

if (process.platform !== "darwin") {
  console.log("[vision-ocr] Skipping helper build on non-macOS platform");
  process.exit(0);
}

if (!existsSync(sourcePath)) {
  console.warn(`[vision-ocr] Source file missing at ${sourcePath}; OCR helper not built`);
  process.exit(0);
}

try {
  execFileSync(
    "xcrun",
    [
      "swiftc",
      "-O",
      "-module-cache-path",
      moduleCachePath,
      "-o",
      outputPath,
      sourcePath,
    ],
    { stdio: "inherit" },
  );
  chmodSync(outputPath, 0o755);
  console.log(`[vision-ocr] Built helper at ${outputPath}`);
} catch (error) {
  console.warn("[vision-ocr] Failed to build helper; OCR will be disabled until this succeeds");
  if (existsSync(outputPath)) {
    rmSync(outputPath, { force: true });
  }
  if (error instanceof Error && error.message.length > 0) {
    console.warn(error.message);
  }
}
