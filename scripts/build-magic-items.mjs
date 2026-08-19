import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.resolve(projectRoot, process.argv[2] ?? "src/data/srd-pages.json");
const targetPath = path.resolve(projectRoot, process.argv[3] ?? "src/data/magic-items.json");
const pages = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const rarityOrder = ["Courant", "Peu courant", "Rare", "Très rare", "Légendaire", "Artefact", "Variable"];
const categoryLine = /^(Anneau|Arme|Armure|Baguette|Bâton|Objet merveilleux|Parchemin|Potion|Sceptre)(?:\s*\(|,)/;

function slug(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function clean(value) {
  return value.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1").trim();
}

function parenthesisBalance(value) {
  return [...value].reduce((balance, character) => balance + (character === "(" ? 1 : character === ")" ? -1 : 0), 0);
}

function normalizedRarities(value) {
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const rarities = [];
  if (/\b(?:courant|courante)s?\b/.test(normalized.replace(/peu\s+courant(?:e|es|s)?/g, ""))) rarities.push("Courant");
  if (/\bpeu\s+courant(?:e|es|s)?\b/.test(normalized)) rarities.push("Peu courant");
  if (/\btres\s+rare?s?\b/.test(normalized)) rarities.push("Très rare");
  const withoutVeryRare = normalized.replace(/tres\s+rares?/g, "");
  if (/\brare?s?\b/.test(withoutVeryRare)) rarities.push("Rare");
  if (/\blegendaires?\b/.test(normalized)) rarities.push("Légendaire");
  if (/\bartefacts?\b/.test(normalized)) rarities.push("Artefact");
  if (/\bvariable\b/.test(normalized) || !rarities.length) rarities.push("Variable");
  return [...new Set(rarities)].sort((left, right) => rarityOrder.indexOf(left) - rarityOrder.indexOf(right));
}

function topLevelComma(value) {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") depth++;
    else if (value[index] === ")") depth--;
    else if (value[index] === "," && depth === 0) return index;
  }
  return -1;
}

const lines = pages.filter(page => page.page >= 220 && page.page <= 266)
  .flatMap(page => page.text.split(/\r?\n/).map(text => ({ text: text.trim(), page: page.page })).filter(line => line.text));
const starts = [];
for (let index = 0; index < lines.length - 1; index++) {
  if (lines[index].text.length <= 90 && categoryLine.test(lines[index + 1].text)) starts.push(index);
}
const titleStart = start => /^[a-zà-ÿ]/.test(lines[start].text) && start > 0 ? start - 1 : start;

const entries = starts.map((start, entryIndex) => {
  const title = clean(lines.slice(titleStart(start), start + 1).map(line => line.text).join(" "));
  let bodyStart = start + 2;
  const headerLines = [lines[start + 1].text];
  while (bodyStart < lines.length && headerLines.length < 5) {
    const joined = clean(headerLines.join(" "));
    const next = lines[bodyStart].text;
    const needsRarity = normalizedRarities(joined).every(rarity => rarity === "Variable") && !/variable/i.test(joined);
    const incomplete = parenthesisBalance(joined) > 0 || /[,([]\s*$/.test(joined);
    const harmonizationContinuation = /^\(Harmonisation requise/i.test(next);
    const rarityContinuation = /^\(\+\d+\)\s+ou\s+(?:très\s+)?rare/i.test(next);
    if (!needsRarity && !incomplete && !harmonizationContinuation && !rarityContinuation) break;
    headerLines.push(next);
    bodyStart++;
  }
  const header = clean(headerLines.join(" "));
  const comma = topLevelComma(header);
  const rarityBoundary = header.search(/\s+(?=(?:courant(?:e)?|peu\s+courant(?:e)?|rare|très\s+rare|légendaire|artefact|variable)\b)/i);
  const separator = comma >= 0 ? comma : rarityBoundary;
  if (separator < 0) throw new Error(`Métadonnées invalides pour ${title}: ${header}`);
  const itemType = clean(header.slice(0, separator));
  const itemCategory = itemType.match(/^(Anneau|Arme|Armure|Baguette|Bâton|Objet merveilleux|Parchemin|Potion|Sceptre)/)?.[1] ?? itemType;
  const rarityText = clean(header.slice(separator + (comma >= 0 ? 1 : 0)).replace(/\s*\(Harmonisation requise[^)]*\)\s*/gi, " "));
  const rarities = normalizedRarities(rarityText);
  const end = entryIndex + 1 < starts.length ? titleStart(starts[entryIndex + 1]) : lines.length;
  const content = clean(lines.slice(bodyStart, end).map(line => line.text).join(" "));
  const harmonization = /Harmonisation requise/i.test(header);
  return {
    id: `magic-item-${slug(title)}`,
    type: "magic-item",
    title,
    page: lines[start].page,
    subtitle: `${itemType} · ${rarityText}`,
    tags: ["Objet magique", itemCategory, ...(itemCategory === itemType ? [] : [itemType]), ...rarities, ...(harmonization ? ["Harmonisation"] : [])],
    meta: {
      "Type d’objet": itemType,
      "Rareté": rarityText,
      "Harmonisation": harmonization ? "Requise" : "Non requise"
    },
    itemType: itemCategory,
    rarities,
    sections: [{ content }]
  };
});

const duplicates = entries.filter((entry, index) => entries.findIndex(candidate => candidate.id === entry.id) !== index);
const invalid = entries.filter(entry => !entry.title || !entry.sections[0].content || !entry.rarities.length);
if (duplicates.length || invalid.length) {
  throw new Error(`Catalogue invalide: ${duplicates.length} doublons, ${invalid.length} fiches incomplètes`);
}

fs.writeFileSync(targetPath, `${JSON.stringify({ version: "SRD 5.2.1 FR", license: "CC BY 4.0", entries }, null, 2)}\n`, "utf8");
console.log(`${entries.length} objets magiques SRD générés vers ${targetPath}`);
