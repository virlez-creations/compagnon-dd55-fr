import "./style.css";
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

function run(force = false): void {
  queued = false;
  if (force || isDnd2024Sheet()) enhanceSheet(document, preferences);
}

function schedule(): void { if (!queued) { queued = true; requestAnimationFrame(() => run()); } }

async function start(): Promise<void> {
  preferences = await loadPreferences();
  if (window.top === window) {
    mountPanel(preferences, (next) => {
      preferences = next;
      if (globalThis.chrome?.storage?.local) void chrome.storage.local.set(next);
      document.querySelectorAll(".dd55-reference").forEach((element) => element.remove());
      run();
    });
  }
  schedule();
  new MutationObserver((mutations) => {
    if (mutations.every(m => (m.target as Element).closest?.("#dd55-companion, #dd55-launcher, .dd55-reference"))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== "object") return;
      if ((message as { type?: string }).type === "DD55_SHOW_ENTRY") {
        const entryId = (message as { entryId?: string }).entryId;
        if (entryId) document.dispatchEvent(new CustomEvent("dd55:open-entry", { detail: entryId }));
        return;
      }
      if ((message as { type?: string }).type !== "DD55_TRANSLATE_SHEET") return;
      preferences = { ...preferences, enabled: true };
      if (globalThis.chrome?.storage?.local) void chrome.storage.local.set(preferences);
      document.querySelectorAll(".dd55-reference").forEach((element) => element.remove());
      run(true);
      const previous = document.querySelector("#dd55-toast");
      previous?.remove();
      const toast = document.createElement("div");
      toast.id = "dd55-toast";
      toast.textContent = "✓ Traduction française appliquée";
      document.body.append(toast);
      window.setTimeout(() => toast.remove(), 2600);
    });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start(), { once: true }); else void start();
