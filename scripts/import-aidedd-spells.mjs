import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const projectRoot = path.resolve(import.meta.dirname, "..");
const targetPath = path.resolve(projectRoot, process.argv[2] ?? "src/data/aidedd-spells.json");
const localPath = path.resolve(projectRoot, "src/data/srd-compendium.json");
const sourceUrl = "https://www.aidedd.org/spell/fr/";
const expectedSchools = new Set(["Abjuration", "Divination", "Enchantement", "Évocation", "Illusion", "Invocation", "Nécromancie", "Transmutation"]);

function normalize(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

const current = JSON.parse(fs.readFileSync(targetPath, "utf8"));
const local = JSON.parse(fs.readFileSync(localPath, "utf8"));
const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0 Compagnon-DD55-FR/1.3.0" } });
if (!response.ok) throw new Error(`AideDD a répondu ${response.status}`);
const document = new JSDOM(await response.text(), { url: sourceUrl }).window.document;

const extracted = [...document.querySelectorAll("table tbody tr")].flatMap(row => {
  const link = row.querySelector(".item a[href*='/spell/fr/']");
  const href = link?.getAttribute("href") ?? "";
  const slug = href.split("/").filter(Boolean).at(-1) ?? "";
  if (!slug) return [];
  const school = row.querySelector(".colE")?.textContent?.trim() ?? "";
  if (!expectedSchools.has(school)) throw new Error(`École inconnue pour ${slug}: ${school}`);
  const levelText = row.querySelector("td.center")?.textContent?.trim() ?? "";
  const level = Number(levelText);
  if (!Number.isInteger(level) || level < 0 || level > 9) throw new Error(`Niveau invalide pour ${slug}: ${levelText}`);
  return [{
    slug,
    nameFr: link?.textContent?.trim() ?? "",
    nameEn: row.querySelector(".colV")?.textContent?.trim() ?? "",
    level,
    school,
    concentration: Boolean(row.querySelector(".colC")?.textContent?.trim()),
    ritual: Boolean(row.querySelector(".colR")?.textContent?.trim())
  }];
});

const duplicates = extracted.filter((item, index) => extracted.findIndex(candidate => candidate.slug === item.slug) !== index);
if (extracted.length !== 391) throw new Error(`${extracted.length} sorts extraits au lieu de 391`);
if (duplicates.length) throw new Error(`${duplicates.length} slugs AideDD dupliqués`);
const extractedBySlug = new Map(extracted.map(item => [item.slug, item]));
const missing = current.filter(item => !extractedBySlug.has(item.slug));
if (missing.length) throw new Error(`${missing.length} références existantes absentes du catalogue AideDD: ${missing.map(item => item.slug).join(", ")}`);

const enriched = current.map(item => {
  const metadata = extractedBySlug.get(item.slug);
  if (!metadata) throw new Error(`Métadonnées absentes pour ${item.slug}`);
  if (metadata.level !== item.level || normalize(metadata.nameEn) !== normalize(item.nameEn)) {
    throw new Error(`Identité AideDD incohérente pour ${item.slug}`);
  }
  return { ...item, school: metadata.school, ritual: metadata.ritual, concentration: metadata.concentration };
});

const localById = new Map(local.entries.filter(entry => entry.type === "spell").map(entry => [entry.id, entry]));
const mismatches = enriched.flatMap(item => {
  if (!item.compendiumId) return [];
  const entry = localById.get(item.compendiumId);
  if (!entry) return [`${item.slug}: fiche locale absente`];
  const localSchool = entry.meta["École"];
  const localRitual = /rituel/i.test(entry.meta["Incantation"] ?? "");
  const localConcentration = /concentration/i.test(entry.meta["Durée"] ?? "");
  return localSchool !== item.school || localRitual !== item.ritual || localConcentration !== item.concentration
    ? [`${item.slug}: AideDD=${item.school}/${item.ritual}/${item.concentration}, SRD=${localSchool}/${localRitual}/${localConcentration}`]
    : [];
});
const resolved = enriched.map(item => {
  if (!item.compendiumId) return item;
  const entry = localById.get(item.compendiumId);
  if (!entry) return item;
  return {
    ...item,
    school: entry.meta["École"],
    ritual: /rituel/i.test(entry.meta["Incantation"] ?? ""),
    concentration: /concentration/i.test(entry.meta["Durée"] ?? "")
  };
});
if (mismatches.length) console.warn(`Métadonnées AideDD remplacées par le SRD local:\n${mismatches.join("\n")}`);

fs.writeFileSync(targetPath, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
console.log(`${resolved.length} sorts enrichis (${resolved.filter(item => item.compendiumId).length} fiches SRD, ${resolved.filter(item => !item.compendiumId).length} références externes)`);
