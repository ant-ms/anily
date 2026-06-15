import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  outDir: "dist",
  splitting: false,
  // Keep all node_modules external — they are resolved from prod deps at runtime
  esbuildOptions(options) {
    options.packages = "external";
  },
});
