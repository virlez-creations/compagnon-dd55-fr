import data from "../data/srd-compendium.json";
import { normalizeName } from "./reference-matcher";

export type CompendiumType = "spell" | "feat" | "rule";

export interface CompendiumSection {
  heading?: string;
  content: string;
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
}

export const compendiumEntries = data.entries as CompendiumEntry[];

const titleIndex = new Map(compendiumEntries.map(entry => [normalizeName(entry.title), entry]));
const aliases: Record<string, string> = {
  "fleche acide de melf": "Flèche acide",
  "eclair tracant": "Rayon traçant",
  "fou rire de tasha": "Fou rire",
  "armure de mage": "Armure du mage"
};

export function findCompendiumEntry(name: string, type?: CompendiumType): CompendiumEntry | undefined {
  const normalized = normalizeName(name);
  const canonical = aliases[normalized] ? normalizeName(aliases[normalized]) : normalized;
  const entry = titleIndex.get(canonical);
  return entry && (!type || entry.type === type) ? entry : undefined;
}

export function searchCompendium(query: string, type?: CompendiumType, limit = 80): CompendiumEntry[] {
  const normalized = normalizeName(query);
  return compendiumEntries
    .filter(entry => (!type || entry.type === type) && (!normalized || normalizeName(`${entry.title} ${entry.subtitle} ${entry.tags.join(" ")}`).includes(normalized)))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"))
    .slice(0, limit);
}
