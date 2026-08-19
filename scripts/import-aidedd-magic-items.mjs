import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const projectRoot = path.resolve(import.meta.dirname, "..");
const targetPath = path.resolve(projectRoot, process.argv[2] ?? "src/data/aidedd-magic-items.json");
const localPath = path.resolve(projectRoot, "src/data/magic-items.json");
const sourceUrl = "https://www.aidedd.org/magic-item/fr/";
const rarityOrder = ["Courant", "Peu courant", "Rare", "Très rare", "Légendaire", "Artefact", "Variable"];

function normalize(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function frenchNames(rawName) {
  const [primary, ...alternatives] = rawName.split("|").map(value => value.trim()).filter(Boolean);
  const prefix = primary.match(/^(.+?)(?=\s+(?:d['’]|de |du |des ))/i)?.[1] ?? "";
  const aliases = alternatives.map(alternative => /^[a-zà-ÿ]/.test(alternative) && prefix ? `${prefix} ${alternative}` : alternative);
  return { primary, aliases };
}

const localTitleAliases = new Map(Object.entries({
  "Mailles elfiques": "Armure de mailles elfique",
  "Carquois d'Ehlonna": "Carquois efficace",
  "Fers de zéphyr": "Fers du zéphyr",
  "Forteresse instantanée de Daern": "Forteresse instantanée",
  "Havresac d'Huard": "Havresac magique",
  "Liens de fer de Bilarro": "Liens de fer",
  "Orbe des dragons": "Orbe draconique",
  "Pigments merveilleux de Nolzur": "Pigments merveilleux",
  "Plume de Quaal": "Plume magique",
  "Submersible de Kwalish": "Submersible du Crabe",
  "Cartes merveilleuses": "Tarot mystérieux"
}).map(([external, local]) => [normalize(external), normalize(local)]));

function normalizedRarities(value) {
  const normalized = normalize(value);
  const rarities = [];
  if (/\b(?:courant|courante)s?\b/.test(normalized.replace(/peu\s+courant(?:e|es|s)?/g, ""))) rarities.push("Courant");
  if (/\bpeu\s+courant(?:e|es|s)?\b/.test(normalized)) rarities.push("Peu courant");
  if (/\btres\s+rare?s?\b/.test(normalized)) rarities.push("Très rare");
  if (/\brare?s?\b/.test(normalized.replace(/tres\s+rares?/g, ""))) rarities.push("Rare");
  if (/\blegendaires?\b/.test(normalized)) rarities.push("Légendaire");
  if (/\bartefacts?\b/.test(normalized)) rarities.push("Artefact");
  if (/\bvariable\b/.test(normalized) || !rarities.length) rarities.push("Variable");
  return [...new Set(rarities)].sort((left, right) => rarityOrder.indexOf(left) - rarityOrder.indexOf(right));
}

const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0 Compagnon-DD55-FR/0.8.8" } });
if (!response.ok) throw new Error(`AideDD a répondu ${response.status}`);
const dom = new JSDOM(await response.text(), { url: sourceUrl });
const localEntries = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, "utf8")).entries : [];
const localByTitle = new Map(localEntries.map(entry => [normalize(entry.title), entry.id]));

const items = [...dom.window.document.querySelectorAll("table tbody tr")].flatMap(row => {
  const nameCell = row.querySelector(".item");
  const rawNameFr = nameCell?.textContent?.trim();
  if (!rawNameFr) return [];
  const { primary: nameFr, aliases } = frenchNames(rawNameFr);
  const link = nameCell.querySelector("a[href*='/magic-item/fr/']");
  const href = link?.getAttribute("href") ?? "";
  const slug = href ? href.split("/").filter(Boolean).at(-1) ?? "" : "";
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return [];
  const rarity = row.querySelector(".colR")?.textContent?.trim() ?? "Variable";
  const nameEn = row.querySelector(".colV")?.textContent?.trim() ?? "";
  const localNames = [nameFr, ...aliases, localTitleAliases.get(normalize(nameFr)) ?? ""];
  return [{
    id: nameEn ? normalize(nameEn).replace(/[^a-z0-9]+/g, "-") : normalize(nameFr).replace(/[^a-z0-9]+/g, "-"),
    nameEn,
    nameFr,
    aliases,
    slug,
    itemType: row.querySelector(".colT")?.textContent?.trim() ?? "Objet magique",
    rarities: normalizedRarities(rarity),
    rarity,
    source: row.querySelector(".colS")?.textContent?.trim() ?? "Dungeon Master's Guide 2024",
    compendiumId: localNames.map(normalize).map(name => localByTitle.get(name)).find(Boolean)
  }];
});

const duplicates = items.filter((item, index) => items.findIndex(candidate => candidate.id === item.id) !== index);
if (duplicates.length) throw new Error(`${duplicates.length} identifiants AideDD dupliqués`);
fs.writeFileSync(targetPath, `${JSON.stringify({ source: sourceUrl, items }, null, 2)}\n`, "utf8");
console.log(`${items.length} références AideDD importées (${items.filter(item => item.slug).length} liens, ${items.filter(item => item.compendiumId).length} fiches SRD liées)`);
