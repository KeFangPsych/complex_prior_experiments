import { defineConfig } from "vite";

// The pictures live one folder up (next to the vignette script), so the dev
// server is allowed to read the parent folder. `base: "./"` makes the built
// site work from any sub-path (GitHub Pages, a lab server folder, ...).
export default defineConfig({
  base: "./",
  server: { port: 8765, fs: { allow: [".."] } },
  preview: { port: 8765 },
  build: { outDir: "dist", emptyOutDir: true },
});
