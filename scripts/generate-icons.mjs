import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const iconDir = path.join(root, "public", "icons");
const svg = await readFile(path.join(iconDir, "icon.svg"), "utf8");
const encoded = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
await mkdir(iconDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
});
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:${size}px;height:${size}px}img{display:block;width:${size}px;height:${size}px}</style><img src="${encoded}">`);
    await page.screenshot({ path: path.join(iconDir, `icon-${size}.png`), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
