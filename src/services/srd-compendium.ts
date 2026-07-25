import data from "../data/srd-compendium.json";
import { normalizeName } from "./reference-matcher";

export type CompendiumType = "spell" | "feat" | "rule" | "class" | "subclass";

export interface CompendiumSection {
  heading?: string;
  content: string;
}

export interface CompendiumTable {
  title: string;
  page: number;
  headers: string[];
  rows: string[][];
}

export interface CompendiumEntry {
  id: string;
  type: CompendiumType;
  title: string;
  page: number;
  subtitle: string;
  tags: string[];
  meta: Record<string, string>;
  sections: CompendiumSection[];
  tables?: CompendiumTable[];
}

export const compendiumEntries = data.entries as CompendiumEntry[];

const titleIndex = new Map<string, CompendiumEntry[]>();
for (const entry of compendiumEntries) {
  const key = normalizeName(entry.title);
  titleIndex.set(key, [...(titleIndex.get(key) ?? []), entry]);
}
const aliases: Record<string, string> = {
  "fleche acide de melf": "Flèche acide",
  "eclair tracant": "Rayon traçant",
  "fou rire de tasha": "Fou rire",
  "armure de mage": "Armure du mage",
  "lutteur": "Empoigneur"
};

export function findCompendiumEntry(name: string, type?: CompendiumType): CompendiumEntry | undefined {
  const normalized = normalizeName(name);
  const canonical = aliases[normalized] ? normalizeName(aliases[normalized]) : normalized;
  const entries = titleIndex.get(canonical) ?? [];
  return type ? entries.find(entry => entry.type === type) : entries[0];
}

export function searchCompendium(query: string, type?: CompendiumType, limit = 80): CompendiumEntry[] {
  const normalized = normalizeName(query);
  const canonical = aliases[normalized] ? normalizeName(aliases[normalized]) : normalized;
  return compendiumEntries
    .filter(entry => (!type || entry.type === type) && (!canonical || normalizeName(`${entry.title} ${entry.subtitle} ${entry.tags.join(" ")}`).includes(canonical)))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"))
    .slice(0, limit);
}
