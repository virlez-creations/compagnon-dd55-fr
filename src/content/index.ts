import "./style.css";
import { mountPanel } from "./panel";
import { enhanceSheet, isDnd2024Sheet } from "./sheet";
import type { Preferences } from "../types";

const defaults: Preferences = { enabled: true, bilingual: true };
let preferences = defaults;
let sheetDetected = false;
let flushTimer: number | undefined;
const pendingRoots = new Set<Element>();

async function loadPreferences(): Promise<Preferences> {
  if (!globalThis.chrome?.storage?.local) return defaults;
  return { ...defaults, ...(await chrome.storage.local.get(defaults)) } as Preferences;
}

function processDocument(force = false): void {
  if (!force && !sheetDetected && !isDnd2024Sheet()) return;
  sheetDetected = true;
  pendingRoots.clear();
  enhanceSheet(document, preferences);
}

function queueRoot(element: Element): void {
  if (element.closest("#dd55-companion, #dd55-launcher, .dd55-reference")) return;
  for (const root of pendingRoots) {
    if (root.contains(element)) return;
    if (element.contains(root)) pendingRoots.delete(root);
  }
  pendingRoots.add(element);
}

function flushRoots(): void {
  flushTimer = undefined;
  if (!sheetDetected) {
    processDocument();
    if (!sheetDetected) pendingRoots.clear();
    return;
  }
  const roots = [...pendingRoots];
  pendingRoots.clear();
  roots.forEach(root => root.isConnected && enhanceSheet(root, preferences));
}

function scheduleFlush(): void {
  if (flushTimer !== undefined) return;
  flushTimer = window.setTimeout(flushRoots, 32);
}

async function start(): Promise<void> {
  preferences = await loadPreferences();
  if (window.top === window) {
    mountPanel(preferences, (next) => {
      preferences = next;
      if (globalThis.chrome?.storage?.local) void chrome.storage.local.set(next);
      document.querySelectorAll(".dd55-reference").forEach((element) => element.remove());
      processDocument(true);
    });
  }
  processDocument();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (!target || target.closest("#dd55-companion, #dd55-launcher, .dd55-reference")) continue;
      const additions = [...mutation.addedNodes];
      if (additions.length && additions.every(node => node instanceof Element && node.matches(".dd55-reference, #dd55-companion, #dd55-launcher"))) continue;
      if (target === document.body && additions.length) {
        additions.forEach(node => {
          const element = node instanceof Element ? node : node.parentElement;
          if (element) queueRoot(element);
        });
      } else {
        queueRoot(target);
      }
    }
    if (pendingRoots.size) scheduleFlush();
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
      processDocument(true);
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
