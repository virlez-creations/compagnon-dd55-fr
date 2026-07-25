import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: fileURLToPath(new URL("./src/content/index.ts", import.meta.url)),
        background: fileURLToPath(new URL("./src/background.ts", import.meta.url))
      },
      output: { entryFileNames: "[name].js", assetFileNames: "content.[ext]" }
    }
  },
  plugins: [{
    name: "copy-manifest",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify({
        manifest_version: 3,
        name: "Compagnon D&D 5.5 FR",
        description: "Traductions françaises et liens AideDD pour la feuille D&D 2024 de Roll20.",
        version: "0.5.2",
        permissions: ["storage", "contextMenus"],
        host_permissions: [
          "https://app.roll20.net/*",
          "https://*.roll20.net/*",
          "https://*.roll20preflight.net/*",
          "https://storage.googleapis.com/roll20-cdn/*"
        ],
        background: { service_worker: "background.js", type: "module" },
        content_scripts: [{
          matches: [
            "https://app.roll20.net/*",
            "https://*.roll20.net/*",
            "https://*.roll20preflight.net/*",
            "https://storage.googleapis.com/roll20-cdn/*"
          ],
          js: ["content.js"],
          css: ["content.css"],
          run_at: "document_idle",
          all_frames: true,
          match_about_blank: true
        }]
      }, null, 2) });
    }
  }]
});
