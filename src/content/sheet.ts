import { translations } from "../data/translations";
import { feats, spells } from "../data/references";
import { normalizeName, referenceUrl } from "../services/reference-matcher";
import { compendiumEntries, findCompendiumEntry, type CompendiumEntry, type CompendiumSection } from "../services/srd-compendium";
import type { Preferences, Reference } from "../types";

const SKIP_SELECTOR = "#dd55-companion, #dd55-launcher, script, style, textarea, input, [contenteditable='true'], .dd55-reference, .dd55-content-translation";
const originalText = new WeakMap<Text, string>();
const translationLookup = new Map(Object.entries(translations).map(([english, french]) => [english.toLocaleLowerCase("en"), french]));
const featureAliases: Record<string, string> = {
  "weapon mastery": "Bottes d’arme", "spellcasting": "Sorts", "favored enemy": "Ennemi juré",
  "fighting style": "Style de combat", "extra attack": "Attaque supplémentaire", "sneak attack": "Attaque sournoise",
  "cunning action": "Ruse", "second wind": "Second souffle", "action surge": "Fougue", "indomitable": "Inflexible",
  "unarmored defense": "Défense sans armure", "danger sense": "Sens du danger", "reckless attack": "Témérité",
  "font of inspiration": "Source d’inspiration", "jack of all trades": "Touche-à-tout", "channel divinity": "Conduit divin",
  "wild shape": "Forme sauvage", "metamagic": "Métamagie", "sorcery points": "Réserve arcanique",
  "arcane recovery": "Restauration magique", "martial arts": "Arts martiaux", "focus points": "Credo du Moine",
  "lay on hands": "Imposition des mains", "divine smite": "Châtiment de paladin", "hunter's mark": "Ennemi juré",
  "ability score improvement": "Amélioration de caractéristique"
};
const classAliases: Record<string, string> = {
  barbarian: "Barbare", bard: "Barde", cleric: "Clerc", druid: "Druide", fighter: "Guerrier", monk: "Moine",
  paladin: "Paladin", ranger: "Rôdeur", rogue: "Roublard", sorcerer: "Ensorceleur", warlock: "Occultiste", wizard: "Magicien"
};
const referenceNameLookup = new Map([...spells, ...feats].map(reference => [normalizeName(reference.nameEn), reference.nameFr]));
const classContextCache = new WeakMap<Document, string>();

interface IndexedReference {
  item: Reference;
  kind: "spell" | "feat";
}

const referenceIndex = new Map<string, IndexedReference>();
for (const indexed of [
  ...spells.map(item => ({ item, kind: "spell" as const })),
  ...feats.map(item => ({ item, kind: "feat" as const }))
]) {
  for (const name of [indexed.item.nameEn, indexed.item.nameFr, ...(indexed.item.aliases ?? [])]) {
    referenceIndex.set(normalizeName(name), indexed);
  }
}

interface ClassFeatureMatch {
  entry: CompendiumEntry;
  title: string;
}

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
    const normalized = normalizeName(trimmed);
    const translated = translations[trimmed] ?? translationLookup.get(trimmed.toLocaleLowerCase("en")) ?? referenceNameLookup.get(normalized)
      ?? featureAliases[normalized] ?? classAliases[normalized] ?? translateDynamicLabel(trimmed);
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

function featureTitle(section: CompendiumSection): string {
  return section.heading?.replace(/^Niveau\s+[\d et]+\s*·\s*/i, "").trim() ?? "";
}

const featureIndex = new Map<string, ClassFeatureMatch[]>();
for (const entry of compendiumEntries) {
  if (entry.type !== "class" && entry.type !== "subclass") continue;
  for (const section of entry.sections) {
    const title = featureTitle(section);
    if (!title) continue;
    const key = normalizeName(title);
    featureIndex.set(key, [...(featureIndex.get(key) ?? []), { entry, title }]);
  }
}

function detectedClass(root: ParentNode): string | undefined {
  const text = root instanceof Document ? root.body?.textContent ?? "" : root.textContent ?? "";
  const normalized = normalizeName(text);
  const found = Object.entries(classAliases).find(([english]) => new RegExp(`(?:^|\\s)${english}(?:\\s|\\d|$)`, "i").test(normalized))?.[1];
  const owner = root instanceof Document ? root : root.ownerDocument;
  if (found && owner) classContextCache.set(owner, found);
  return found ?? (owner ? classContextCache.get(owner) : undefined);
}

function findClassFeature(value: string, className?: string): ClassFeatureMatch | undefined {
  const normalizedEnglish = normalizeName(value);
  const french = featureAliases[normalizedEnglish] ?? translations[value] ?? translationLookup.get(value.toLocaleLowerCase("en")) ?? value;
  const wanted = normalizeName(french);
  let candidates = featureIndex.get(wanted) ?? [];
  if (className) {
    const contextual = candidates.filter(candidate => candidate.entry.title === className || candidate.entry.tags.includes(className));
    if (contextual.length) candidates = contextual;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

function appendCompendiumReference(element: HTMLElement, entry: CompendiumEntry): void {
  if (element.closest(SKIP_SELECTOR) || element.querySelector(":scope > .dd55-reference")) return;
  const badge = document.createElement("span");
  badge.className = "dd55-reference";
  badge.innerHTML = `<span role="button" tabindex="0" data-dd55-open="${entry.id}" title="Ouvrir dans le compendium">Compendium</span>`;
  const openLocal = () => {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) void chrome.runtime.sendMessage({ type: "DD55_OPEN_COMPENDIUM", entryId: entry.id });
    else document.dispatchEvent(new CustomEvent("dd55:open-entry", { detail: entry.id }));
  };
  badge.querySelector("[data-dd55-open]")?.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openLocal(); });
  badge.querySelector("[data-dd55-open]")?.addEventListener("keydown", event => { if ((event as KeyboardEvent).key === "Enter") openLocal(); });
  element.append(badge);
}

function appendReference(element: HTMLElement, match: Reference, kind: "spell" | "feat", preferences: Preferences): void {
    if (element.closest(SKIP_SELECTOR) || element.querySelector(":scope > .dd55-reference")) return;
    const local = findCompendiumEntry(match.nameFr, kind);
    const badge = document.createElement("span");
    badge.className = "dd55-reference";
    const frenchAlreadyVisible = normalizeName(element.textContent ?? "") === normalizeName(match.nameFr);
    badge.innerHTML = `${frenchAlreadyVisible ? "" : `<span lang="fr">${escapeHtml(match.nameFr)}</span>`}${preferences.bilingual ? `<small lang="en">${escapeHtml(match.nameEn)}</small>` : ""}${local ? `<span role="button" tabindex="0" data-dd55-open="${local.id}" title="Ouvrir dans le compendium">Compendium</span>` : `<a href="${referenceUrl(kind, match)}" target="_blank" rel="noopener noreferrer" title="Voir ${escapeHtml(match.nameFr)} sur AideDD">AideDD ↗</a>`}`;
    const openLocal = () => {
      if (!local) return;
      if (typeof chrome !== "undefined" && chrome.runtime?.id) void chrome.runtime.sendMessage({ type: "DD55_OPEN_COMPENDIUM", entryId: local.id });
      else document.dispatchEvent(new CustomEvent("dd55:open-entry", { detail: local.id }));
    };
    badge.querySelector("[data-dd55-open]")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openLocal(); });
    badge.querySelector("[data-dd55-open]")?.addEventListener("keydown", (event) => { if ((event as KeyboardEvent).key === "Enter") openLocal(); });
    element.append(badge);
}

function enrichReferences(root: ParentNode, preferences: Preferences): void {
  const owner = root instanceof Document ? root : root.ownerDocument ?? document;
  const walker = owner.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  const handled = new Set<HTMLElement>();
  textNodes.forEach(node => {
    const element = node.parentElement;
    if (!element || element.closest(SKIP_SELECTOR) || handled.has(element)) return;
    const original = originalText.get(node)?.trim() ?? "";
    const visible = node.data.trim();
    if ((!original || original.length > 100) && (!visible || visible.length > 100)) return;
    const indexed = referenceIndex.get(normalizeName(original)) ?? referenceIndex.get(normalizeName(visible));
    if (!indexed) return;
    handled.add(element);
    appendReference(element, indexed.item, indexed.kind, preferences);
  });
  root.querySelectorAll<HTMLElement>("button, a, h3, h4, strong, [role='row'], [data-testid*='name' i]").forEach((element) => {
    if (handled.has(element) || element.closest(SKIP_SELECTOR) || element.querySelector(":scope > .dd55-reference")) return;
    const raw = element.childElementCount ? [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(" ") : element.textContent;
    const value = raw?.trim() ?? "";
    if (!value || value.length > 100) return;
    const indexed = referenceIndex.get(normalizeName(value));
    if (indexed) appendReference(element, indexed.item, indexed.kind, preferences);
  });
}

function enrichClassContent(root: ParentNode): void {
  const className = detectedClass(root);
  root.querySelectorAll<HTMLElement>("button, h3, h4, strong, [role='row'], [data-testid*='name' i]").forEach(element => {
    if (element.closest(SKIP_SELECTOR)) return;
    const raw = element.childElementCount
      ? [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" ").trim()
      : element.textContent?.trim() ?? "";
    if (!raw || raw.length > 90) return;
    const content = findClassFeature(raw, className);
    if (content) appendCompendiumReference(element, content.entry);
  });
}

function escapeHtml(value: string): string { const span = document.createElement("span"); span.textContent = value; return span.innerHTML; }

export function enhanceSheet(root: ParentNode, preferences: Preferences): void {
  root.querySelectorAll(".dd55-content-translation").forEach(element => element.remove());
  translateSheet(root, preferences.enabled);
  if (!preferences.enabled) { root.querySelectorAll(".dd55-reference, .dd55-content-translation").forEach((e) => e.remove()); return; }
  enrichReferences(root, preferences);
  enrichClassContent(root);
}
