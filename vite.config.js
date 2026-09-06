import { defineConfig } from "vite";

// Relative base so the build works both on GitHub Pages (sub-path)
// and when opened directly via file:// (E2E tests).
export default defineConfig({
  base: "./",
  build: {
    // Keep the bundle readable; the app is tiny.
    target: "es2018"
  }
});