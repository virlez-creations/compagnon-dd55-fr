import { translations } from "../data/translations";
import { feats, spells } from "../data/references";
import { findReference, referenceUrl } from "../services/reference-matcher";
import { findCompendiumEntry } from "../services/srd-compendium";
import type { Preferences, Reference } from "../types";

const SKIP_SELECTOR = "#dd55-companion, #dd55-launcher, script, style, textarea, input, [contenteditable='true'], .dd55-reference";
const originalText = new WeakMap<Text, string>();
const translationLookup = new Map(Object.entries(translations).map(([english, french]) => [english.toLocaleLowerCase("en"), french]));

function translateDynamicLabel(value: string): string | undefined {
  let match = value.match(/^([+-]?\d+)\s+Attack$/i);
  if (match) return `${match[1]} Attaque`;
  match = value.match(/^(\d+(?:\/\d+)?)\s*ft\.?$/i);
  if (match) return `${match[1]} pi`;
  match = value.match(/^Level\s+(\d+)(\+)?$/i);
  if (match) return `Niveau ${match[1]}${match[2] ?? ""}`;
  match = value.match(/^Level\s+(\d+)\s+Feat$/i);
  if (match) return `Don de niveau ${match[1]}`;
  match = value.match(/^New Item\s*\(Attack\s*(\d+)\)$/i);
  if (match) return `Nouvel objet (Attaque ${match[1]})`;
  match = value.match(/^Prerequisite:\s*(.+)$/i);
  if (match) {
    const prerequisite = match[1]
      .replace(/Fighting Style Feature/gi, "don Style de combat")
      .replace(/Level\s+(\d+)/gi, "niveau $1")
      .replace(/Strength/gi, "Force").replace(/Dexterity/gi, "Dextérité")
      .replace(/Wisdom/gi, "Sagesse").replace(/Charisma/gi, "Charisme");
    return `Prérequis : ${prerequisite}`;
  }
  return undefined;
}

export function isDnd2024Sheet(root: ParentNode = document): boolean {
  const explicit = root.querySelector("[data-sheet-type*='dnd2024' i], [data-character-sheet*='2024' i], .dnd2024, .sheet-2024, [aria-label*='D&D 2024' i]");
  if (explicit) return true;
  const text = root instanceof Element ? root.textContent ?? "" : document.body?.textContent ?? "";
  if (/D&D\s*(?:5e\s*)?2024|Dungeons\s*&\s*Dragons\s*2024/i.test(text)) return true;
  const signature = ["ABILITIES", "AC/SPEED", "FEATURES & TRAITS", "CLASS FEATURES", "CONDITION IMMUNITIES", "PROFICIENCY BONUS"];
  const upperText = text.toLocaleUpperCase("en");
  return signature.filter(marker => upperText.includes(marker)).length >= 3;
}

export function translateSheet(root: ParentNode, enabled: boolean): void {
  const owner = root instanceof Document ? root : root.ownerDocument ?? document;
  const walker = owner.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(candidate) {
      const element = candidate.parentElement;
      if (!element || element.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return candidate.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const element = node.parentElement;
    if (!element) return;
    if (!originalText.has(node)) originalText.set(node, node.data);
    const original = originalText.get(node)!;
    const trimmed = original.trim();
    const translated = translations[trimmed] ?? translationLookup.get(trimmed.toLocaleLowerCase("en")) ?? translateDynamicLabel(trimmed);
    if (translated && enabled) {
      const nextText = original.replace(trimmed, translated);
      if (node.data !== nextText) node.data = nextText;
      element.title ||= trimmed;
      element.dataset.dd55Translated = "true";
    } else if (!enabled && element.dataset.dd55Translated) {
      if (node.data !== original) node.data = original;
      delete element.dataset.dd55Translated;
    }
  });
}

function enrichCandidates(root: ParentNode, references: Reference[], kind: "spell" | "feat", preferences: Preferences): void {
  root.querySelectorAll<HTMLElement>("button, a, h3, h4, [role='row'], [data-testid*='name' i]").forEach((element) => {
    if (element.closest(SKIP_SELECTOR) || element.querySelector(":scope > .dd55-reference")) return;
    const raw = element.childElementCount ? [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(" ") : element.textContent;
    const match = findReference(raw?.trim() ?? "", references);
    if (!match) return;
    const local = findCompendiumEntry(match.nameFr, kind);
    const badge = document.createElement("span");
    badge.className = "dd55-reference";
    badge.innerHTML = `<span lang="fr">${escapeHtml(match.nameFr)}</span>${preferences.bilingual ? `<small lang="en">${escapeHtml(match.nameEn)}</small>` : ""}${local ? `<span role="button" tabindex="0" data-dd55-open="${local.id}" title="Ouvrir dans le compendium">Compendium</span>` : `<a href="${referenceUrl(kind, match)}" target="_blank" rel="noopener noreferrer" title="Voir ${escapeHtml(match.nameFr)} sur AideDD">AideDD ↗</a>`}`;
    const openLocal = () => {
      if (!local) return;
      if (typeof chrome !== "undefined" && chrome.runtime?.id) void chrome.runtime.sendMessage({ type: "DD55_OPEN_COMPENDIUM", entryId: local.id });
      else document.dispatchEvent(new CustomEvent("dd55:open-entry", { detail: local.id }));
    };
    badge.querySelector("[data-dd55-open]")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openLocal(); });
    badge.querySelector("[data-dd55-open]")?.addEventListener("keydown", (event) => { if ((event as KeyboardEvent).key === "Enter") openLocal(); });
    element.append(badge);
  });
}

function escapeHtml(value: string): string { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }

export function enhanceSheet(root: ParentNode, preferences: Preferences): void {
  translateSheet(root, preferences.enabled);
  if (!preferences.enabled) { root.querySelectorAll(".dd55-reference").forEach((e) => e.remove()); return; }
  enrichCandidates(root, spells, "spell", preferences);
  enrichCandidates(root, feats, "feat", preferences);
}
