import { defineConfig } from "tsup";

/**
 * Build configuration for the @umituz/web-ai package.
 * Produces CJS, ESM, and type declarations for the root entry plus the
 * per-layer subpath entries (for tree-shakable imports). The root entry is
 * React-free on purpose — it stays safe to import from a Cloudflare Worker.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/index": "src/core/index.ts",
    "providers/index": "src/providers/index.ts",
    "chat/index": "src/chat/index.ts",
    "content/index": "src/content/index.ts",
    "wizard/index": "src/wizard/index.ts",
    "hooks/index": "src/hooks/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react"],
  target: "es2022",
  splitting: false,
  treeshake: true,
  sourcemap: true,
});
