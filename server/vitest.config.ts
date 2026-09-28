import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL("./lib", import.meta.url)),
      $src: fileURLToPath(new URL("./src", import.meta.url)),
      generated: fileURLToPath(new URL("./generated", import.meta.url)),
    },
  },
});
