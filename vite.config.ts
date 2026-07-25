import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./src/content/index.ts", import.meta.url)),
      output: { entryFileNames: "content.js", assetFileNames: "content.[ext]" }
    }
  },
  plugins: [{
    name: "copy-manifest",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify({
        manifest_version: 3,
        name: "Compagnon D&D 5.5 FR",
        description: "Traductions françaises et liens AideDD pour la feuille D&D 2024 de Roll20.",
        version: "0.2.1",
        permissions: ["storage"],
        host_permissions: ["https://app.roll20.net/*"],
        content_scripts: [{ matches: ["https://app.roll20.net/*"], js: ["content.js"], css: ["content.css"], run_at: "document_idle" }]
      }, null, 2) });
    }
  }]
});
