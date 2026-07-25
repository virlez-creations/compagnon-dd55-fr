import "./style.css";
import "./srd-style.css";
import { mountPanel } from "./panel";
import { enhanceSheet, isDnd2024Sheet } from "./sheet";
import type { Preferences } from "../types";

const defaults: Preferences = { enabled: true, bilingual: true };
let preferences = defaults;
let queued = false;

async function loadPreferences(): Promise<Preferences> {
  if (!globalThis.chrome?.storage?.local) return defaults;
  return { ...defaults, ...(await chrome.storage.local.get(defaults)) } as Preferences;
}

function run(): void {
  queued = false;
  if (isDnd2024Sheet()) enhanceSheet(document, preferences);
}

function schedule(): void { if (!queued) { queued = true; requestAnimationFrame(run); } }

async function start(): Promise<void> {
  preferences = await loadPreferences();
  mountPanel(preferences, (next) => {
    preferences = next;
    if (globalThis.chrome?.storage?.local) void chrome.storage.local.set(next);
    document.querySelectorAll(".dd55-reference").forEach((element) => element.remove());
    run();
  });
  schedule();
  new MutationObserver((mutations) => {
    if (mutations.every(m => (m.target as Element).closest?.("#dd55-companion, #dd55-launcher, .dd55-reference"))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true }); else void start();
