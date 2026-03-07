import { defineConfig } from "tsdown";

// Main process — bundles ALL deps except native modules & Electron
const main = defineConfig({
  entry: { main: "src/main.ts" },
  format: "cjs",
  outDir: "dist-electron",
  sourcemap: true,
  clean: true,
  external: [
    "electron",
    "better-sqlite3",
    // The Bun SQLite driver is only used when running under Bun (dev mode).
    // In the Electron build (Node.js runtime), only the node driver is needed.
    "@effect/sql-sqlite-bun",
    "@effect/sql-sqlite-bun/SqliteClient",
  ],
  noExternal: /.*/,
});

// Preload — MUST be built separately to avoid rolldown code-splitting.
// If built together with main, rolldown creates a shared chunk (require('./main.cjs'))
// which fails in Electron's sandboxed preload environment (only require("electron") works).
const preload = defineConfig({
  entry: { preload: "src/preload.ts" },
  format: "cjs",
  outDir: "dist-electron",
  sourcemap: true,
  // Don't clean — main's output is already there
  clean: false,
  external: ["electron"],
  noExternal: /.*/,
});

export default [main, preload];
