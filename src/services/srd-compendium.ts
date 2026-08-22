import data from "../data/srd-compendium.json";
import magicItems from "../data/magic-items.json";
import monstersJson from "../data/monsters.json?raw";
import { equipmentEntries } from "../data/equipment";
import { originEntries } from "../data/origins";
import { additionalRuleEntries } from "../data/rules";
import { normalizeName } from "./reference-matcher";

export type CompendiumType = "spell" | "feat" | "rule" | "class" | "subclass" | "equipment" | "species" | "background" | "magic-item" | "monster";

export interface MonsterAbility {
  score: number;
  modifier: string;
  save: string;
}

export type MonsterActionSection = "Actions" | "Actions Bonus" | "Réactions" | "Actions Légendaires";

export interface MonsterAttack {
  mode: "melee" | "ranged" | "melee-or-ranged";
  bonus: number;
  range?: string | null;
}

export interface MonsterSave {
  ability: "Force" | "Dextérité" | "Constitution" | "Intelligence" | "Sagesse" | "Charisme";
  dc: number;
}

export interface MonsterRollComponent {
  kind: "damage" | "healing";
  formula: string;
  average: number;
  damageType?: string;
}

export interface MonsterAction {
  id: string;
  section: MonsterActionSection;
  name: string;
  description: string;
  attack?: MonsterAttack | null;
  saves: MonsterSave[];
  rolls: MonsterRollComponent[];
  referenceActionId?: string;
}

export interface MonsterData {
  category: "Monstres de A à Z" | "Animaux";
  creatureType: string;
  subtype?: string | null;
  sizes: string[];
  alignment: string;
  challengeRating: string;
  challengeValue: number;
  armorClass: number;
  hitPoints: number;
  movementModes: string[];
  legendary: boolean;
  abilities: Record<"For" | "Dex" | "Con" | "Int" | "Sag" | "Cha", MonsterAbility>;
  actionIntroductions: Partial<Record<MonsterActionSection, string>>;
  actions: MonsterAction[];
}

export interface CompendiumLink {
  label: string;
  entryId: string;
  title: string;
}

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
  links?: CompendiumLink[];
  itemType?: string;
  rarities?: import("../types").MagicItemRarity[];
  monster?: MonsterData;
  source?: {
    label: string;
    url?: string;
    pageLabel?: string;
  };
}

export interface CompendiumSearchResult {
  entry: CompendiumEntry;
  score: number;
  matchedFields: Array<"title" | "alias" | "subtitle" | "tags" | "meta" | "content">;
  excerpt: string;
}

const monsterEntries = (JSON.parse(monstersJson) as { entries: CompendiumEntry[] }).entries;
export const compendiumEntries = [...data.entries, ...equipmentEntries, ...originEntries, ...additionalRuleEntries, ...magicItems.entries, ...monsterEntries] as CompendiumEntry[];

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

const aliasesByTitle = new Map<string, string[]>();
for (const [alias, title] of Object.entries(aliases)) {
  const key = normalizeName(title);
  aliasesByTitle.set(key, [...(aliasesByTitle.get(key) ?? []), alias]);
}

function normalizeSearchValue(value: string): string {
  return normalizeName(value).replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

type SearchIndexItem = {
  entry: CompendiumEntry;
  fields: Record<CompendiumSearchResult["matchedFields"][number], string>;
};

function entryContentBlocks(entry: CompendiumEntry): string[] {
  const sections = entry.sections.map(section => [section.heading, section.content].filter(Boolean).join(" — "));
  if (!entry.monster) return sections;
  const actions = entry.monster.actions.map(action => `${action.section} — ${action.name}. ${action.description}`);
  return [...sections, ...actions];
}

function entrySummary(entry: CompendiumEntry): string {
  return entry.sections.find(section => section.content)?.content ?? entry.monster?.actions[0]?.description ?? "";
}

let searchIndex: SearchIndexItem[] | undefined;
function getSearchIndex(): SearchIndexItem[] {
  searchIndex ??= compendiumEntries.map(entry => ({
    entry,
    fields: {
      title: normalizeSearchValue(entry.title),
      alias: normalizeSearchValue((aliasesByTitle.get(normalizeName(entry.title)) ?? []).join(" ")),
      subtitle: normalizeSearchValue(entry.subtitle),
      tags: normalizeSearchValue(entry.tags.join(" ")),
      meta: normalizeSearchValue(Object.entries(entry.meta).flat().join(" ")),
      content: normalizeSearchValue(entryContentBlocks(entry).join(" "))
    }
  }));
  return searchIndex;
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function tokenQuality(queryToken: string, value: string): number {
  const tokens = value.split(" ").filter(Boolean);
  let best = 0;
  for (const token of tokens) {
    if (token === queryToken) best = Math.max(best, 1);
    else if (queryToken.length >= 3 && token.startsWith(queryToken)) best = Math.max(best, .88);
    else if (queryToken.length >= 3 && token.includes(queryToken)) best = Math.max(best, .72);
    else if (queryToken.length >= 4) {
      const allowance = queryToken.length >= 8 ? 2 : 1;
      if (Math.abs(token.length - queryToken.length) <= allowance && levenshtein(queryToken, token) <= allowance) best = Math.max(best, .55);
    }
  }
  return best;
}

function makeExcerpt(entry: CompendiumEntry, queryTokens: string[]): string {
  const contents = entryContentBlocks(entry);
  const source = contents.find(content => queryTokens.some(token => tokenQuality(token, normalizeSearchValue(content)) > 0)) ?? entrySummary(entry);
  if (source.length <= 170) return source;
  const normalized = normalizeSearchValue(source);
  const position = Math.max(0, ...queryTokens.map(token => normalized.indexOf(token)).filter(index => index >= 0));
  const start = Math.max(0, Math.min(source.length - 170, position - 55));
  return `${start ? "…" : ""}${source.slice(start, start + 170).trim()}${start + 170 < source.length ? "…" : ""}`;
}

export function searchCompendiumResults(query: string, type?: CompendiumType, limit = 80): CompendiumSearchResult[] {
  const normalizedQuery = normalizeSearchValue(query);
  const canonicalQuery = aliases[normalizedQuery] ? normalizeSearchValue(aliases[normalizedQuery]) : normalizedQuery;
  const queryTokens = canonicalQuery.split(" ").filter(Boolean);
  if (!queryTokens.length) return compendiumEntries
    .filter(entry => !type || entry.type === type)
    .slice(0, limit)
    .map(entry => ({ entry, score: 0, matchedFields: [], excerpt: entrySummary(entry) }));
  const weights = { title: 1000, alias: 850, subtitle: 500, tags: 450, meta: 350, content: 100 } as const;

  return getSearchIndex().flatMap(({ entry, fields }) => {
    if (type && entry.type !== type) return [];
    const matchedFields = new Set<CompendiumSearchResult["matchedFields"][number]>();
    let score = fields.title === canonicalQuery ? 10000 : fields.title.startsWith(canonicalQuery) ? 7000 : 0;
    for (const token of queryTokens) {
      let bestScore = 0;
      let bestField: keyof typeof fields | undefined;
      for (const [field, value] of Object.entries(fields) as Array<[keyof typeof fields, string]>) {
        const quality = tokenQuality(token, value);
        const fieldScore = quality * weights[field];
        if (fieldScore > bestScore) { bestScore = fieldScore; bestField = field; }
      }
      if (!bestField) return [];
      matchedFields.add(bestField);
      score += bestScore;
    }
    return [{ entry, score, matchedFields: [...matchedFields], excerpt: makeExcerpt(entry, queryTokens) } satisfies CompendiumSearchResult];
  }).sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length || a.entry.title.localeCompare(b.entry.title, "fr")).slice(0, limit);
}

export function findCompendiumEntry(name: string, type?: CompendiumType): CompendiumEntry | undefined {
  const normalized = normalizeName(name);
  const canonical = aliases[normalized] ? normalizeName(aliases[normalized]) : normalized;
  const entries = titleIndex.get(canonical) ?? [];
  return type ? entries.find(entry => entry.type === type) : entries[0];
}

export function searchCompendium(query: string, type?: CompendiumType, limit = 80): CompendiumEntry[] {
  return searchCompendiumResults(query, type, limit).map(result => result.entry);
}
