import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    main: "src/main.ts",
    preload: "src/preload.ts",
  },
  format: "cjs",
  outDir: "dist-electron",
  sourcemap: true,
  clean: true,
  external: ["electron"],
  noExternal: (id) => id.startsWith("@clipm/"),
});
