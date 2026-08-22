import { feats, spells } from "../data/references";
import magicItemsData from "../data/aidedd-magic-items.json";
import { findReference, normalizeName, referenceUrl } from "../services/reference-matcher";
import { buildMonsterRollCommand, isMonsterActionRollable, prepareRoll20Chat, resolveMonsterAction, type MonsterAttackRollMode } from "../services/roll20-monster";
import { compendiumEntries, findCompendiumEntry, searchCompendiumResults, type CompendiumEntry, type CompendiumSearchResult, type CompendiumTable, type CompendiumType, type MonsterAction, type MonsterActionSection } from "../services/srd-compendium";
import type { MagicItemRarity, MagicItemReference, MonsterRollMode, Preferences, Reference } from "../types";

type CompendiumFilter = CompendiumType | "classes" | "origins";
type ExternalReference = { item: Reference | MagicItemReference; kind: "spell" | "feat" | "magic-item" };
type ExternalSearchResult = ExternalReference & { score: number };
type MagicItemSort = "name" | "rarity-asc" | "rarity-desc";
type MonsterRollTarget = { entry: CompendiumEntry; action: MonsterAction };
const magicItemRarities: MagicItemRarity[] = ["Courant", "Peu courant", "Rare", "Très rare", "Légendaire", "Artefact", "Variable"];
const magicItemRarityRank = new Map(magicItemRarities.map((rarity, index) => [rarity, index]));
const typeLabels: Record<CompendiumType, string> = { spell: "Sort", feat: "Don", rule: "Règle", class: "Classe", subclass: "Sous-classe", equipment: "Équipement", species: "Espèce", background: "Historique", "magic-item": "Objet magique", monster: "Monstre" };
const spellClassNames = [...new Set(compendiumEntries
  .filter(entry => entry.type === "spell")
  .flatMap(entry => (entry.meta.Classes ?? "").split(", ").filter(Boolean)))].sort((a, b) => a.localeCompare(b, "fr"));
const spellLevels = ["Mineur", ...Array.from({ length: 9 }, (_, index) => String(index + 1))];
const equipmentTypes = [...new Set(compendiumEntries.filter(entry => entry.type === "equipment").map(entry => entry.meta["Type d’équipement"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const weaponMasteries = [...new Set(compendiumEntries.filter(entry => entry.type === "equipment").map(entry => entry.meta["Botte d’arme"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const ruleKinds = [...new Set(compendiumEntries.filter(entry => entry.type === "rule").map(entry => entry.meta.Catégorie || entry.subtitle).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const monsterEntries = compendiumEntries.filter(entry => entry.type === "monster" && entry.monster);
const monsterTypes = [...new Set(monsterEntries.map(entry => entry.monster!.creatureType))].sort((a, b) => a.localeCompare(b, "fr"));
const monsterSizeOrder = ["TP", "P", "M", "G", "TG", "Gig"];
const monsterSizes = monsterSizeOrder.filter(size => monsterEntries.some(entry => entry.monster!.sizes.includes(size)));
const monsterAlignments = [...new Set(monsterEntries.map(entry => entry.monster!.alignment))].sort((a, b) => a.localeCompare(b, "fr"));
const monsterMovementModes = ["Marche", "Vol", "Nage", "Escalade", "Fouissement"].filter(mode => monsterEntries.some(entry => entry.monster!.movementModes.includes(mode)));
const monsterChallengeRatings = [...new Set(monsterEntries.map(entry => entry.monster!.challengeRating))]
  .sort((left, right) => monsterEntries.find(entry => entry.monster!.challengeRating === left)!.monster!.challengeValue - monsterEntries.find(entry => entry.monster!.challengeRating === right)!.monster!.challengeValue);
const monsterChallengeValues = new Map(monsterEntries.map(entry => [entry.monster!.challengeRating, entry.monster!.challengeValue]));
const featCategoryLabels: Record<string, string> = {
  origin: "Don d’origines",
  general: "Don général",
  "fighting-style": "Don de Style de combat",
  "epic-boon": "Don de faveur épique",
  dragonmark: "Don de dracogramme"
};
const featCategoryOrder = ["origin", "general", "fighting-style", "epic-boon", "dragonmark"];
const featCategories = featCategoryOrder.filter(category => feats.some(feat => feat.category === category));
const featSources = [...new Set(feats.map(feat => feat.source).filter((source): source is string => Boolean(source)))];
function hasLocalEntry(item: Reference, kind: "spell" | "feat" | "magic-item"): boolean {
  if (item.compendiumId) return true;
  return [item.nameFr, item.nameEn, ...(item.aliases ?? [])].some(name => findCompendiumEntry(name, kind));
}
const externalReferenceCatalog: ExternalReference[] = [
  ...spells.map(item => ({ item, kind: "spell" as const })),
  ...feats.map(item => ({ item, kind: "feat" as const })),
  ...(magicItemsData.items as MagicItemReference[]).map(item => ({ item, kind: "magic-item" as const }))
].filter(({ item, kind }) => !hasLocalEntry(item, kind));
const localFeatReferences = new Map(compendiumEntries
  .filter(entry => entry.type === "feat")
  .flatMap(entry => {
    const reference = findReference(entry.title, feats);
    return reference ? [[entry.id, reference] as const] : [];
  }));
const indexedExternalReferenceCatalog = externalReferenceCatalog.map(reference => ({
  ...reference,
  normalizedTitle: normalizeName(reference.item.nameFr),
  searchTokens: searchTokens(`${reference.item.nameFr} ${reference.item.nameEn} ${(reference.item.aliases ?? []).join(" ")}`)
}));
const localFeatCount = compendiumEntries.filter(entry => entry.type === "feat").length;
const featReferenceCount = localFeatCount + externalReferenceCatalog.filter(reference => reference.kind === "feat").length;
const localSpellCount = compendiumEntries.filter(entry => entry.type === "spell").length;
const spellReferenceCount = localSpellCount + externalReferenceCatalog.filter(reference => reference.kind === "spell").length;
const localMagicItemCount = compendiumEntries.filter(entry => entry.type === "magic-item").length;
const magicItemReferenceCount = localMagicItemCount + externalReferenceCatalog.filter(reference => reference.kind === "magic-item").length;
const totalReferenceCount = compendiumEntries.length + externalReferenceCatalog.length;

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function searchTokens(value: string): string[] {
  return normalizeName(value).replace(/[^\p{L}\p{N}]+/gu, " ").split(" ").filter(Boolean);
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = row[0]; row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const above = row[rightIndex];
      row[rightIndex] = Math.min(row[rightIndex] + 1, row[rightIndex - 1] + 1, diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[right.length];
}

function externalReferences(query: string, type?: CompendiumFilter): ExternalSearchResult[] {
  if (type === "classes" || type === "class" || type === "subclass") return [];
  const wanted = searchTokens(query);
  return indexedExternalReferenceCatalog.flatMap(reference => {
    if (type && type !== reference.kind) return [];
    const title = reference.normalizedTitle;
    const tokens = reference.searchTokens;
    let score = title === normalizeName(query) ? 10000 : title.startsWith(normalizeName(query)) ? 7000 : 0;
    for (const wantedToken of wanted) {
      const exact = tokens.some(token => token === wantedToken);
      const partial = wantedToken.length >= 3 && tokens.some(token => token.startsWith(wantedToken) || token.includes(wantedToken));
      const allowance = wantedToken.length >= 8 ? 2 : wantedToken.length >= 4 ? 1 : 0;
      const fuzzy = allowance > 0 && tokens.some(token => Math.abs(token.length - wantedToken.length) <= allowance && editDistance(token, wantedToken) <= allowance);
      if (!exact && !partial && !fuzzy) return [];
      score += exact ? 800 : partial ? 600 : 400;
    }
    return [{ ...reference, score }];
  }).sort((a, b) => b.score - a.score || a.item.nameFr.localeCompare(b.item.nameFr, "fr"));
}

function highlightText(value: string, query: string): string {
  const terms = query.split(/\s+/).map(term => term.trim()).filter(term => term.length > 1).sort((a, b) => b.length - a.length);
  if (!terms.length) return escapeHtml(value);
  const accents: Record<string, string> = { a: "aàâä", c: "cç", e: "eéèêë", i: "iîï", o: "oôö", u: "uùûü", y: "yÿ" };
  const pattern = (term: string) => [...term].map(character => {
    const variants = accents[character.toLocaleLowerCase("fr")];
    return variants ? `[${variants}]` : character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  const expression = new RegExp(`(${terms.map(pattern).join("|")})`, "gi");
  return value.split(expression).map(part => terms.some(term => normalizeName(part) === normalizeName(term)) ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)).join("");
}

function renderEntryCard(result: CompendiumSearchResult, query: string): string {
  const { entry } = result;
  const summary = result.excerpt || entry.sections.find(section => section.content)?.content || entry.monster?.actions[0]?.description || "";
  const icon = entry.type === "spell" ? "✦" : entry.type === "feat" ? "◆" : entry.type === "class" ? "♜" : entry.type === "subclass" ? "♟" : entry.type === "equipment" ? "⚔" : entry.type === "species" ? "♧" : entry.type === "background" ? "⌂" : entry.type === "magic-item" ? "◈" : entry.type === "monster" ? "♞" : "§";
  return `<button type="button" class="dd55-entry-card" data-entry-id="${entry.id}"><span class="dd55-entry-icon" data-kind="${entry.type}">${icon}</span><span class="dd55-entry-main"><strong>${highlightText(entry.title, query)}</strong><small>${highlightText(entry.subtitle, query)}</small>${summary ? `<span>${highlightText(summary.slice(0, 170), query)}${summary.length > 170 ? "…" : ""}</span>` : ""}</span><span class="dd55-chevron">›</span></button>`;
}

function renderExternalCard({ item, kind }: ExternalReference, query: string): string {
  const magicItem = kind === "magic-item" ? item as MagicItemReference : undefined;
  const subtype = kind === "spell" ? item.level === 0 ? "Sort mineur" : `Sort de niveau ${item.level}` : kind === "feat" ? featCategoryLabels[item.category ?? ""] ?? "Don" : `${magicItem!.itemType} · ${magicItem!.rarity}`;
  const source = item.source ? ` · ${item.source}` : "";
  return `<button type="button" class="dd55-entry-card dd55-external" data-external-url="${referenceUrl(kind, item)}"><span class="dd55-entry-icon" data-kind="external">↗</span><span class="dd55-entry-main"><strong>${highlightText(item.nameFr, query)}</strong><small>${highlightText(`${subtype} · ${item.nameEn}${source}`, query)}</small><span>Absent du SRD · consulter sur AideDD</span></span></button>`;
}

function raritySortValue(rarities: MagicItemRarity[] | undefined, direction: "asc" | "desc"): number {
  const ranks = (rarities?.length ? rarities : ["Variable" as const]).map(rarity => magicItemRarityRank.get(rarity) ?? magicItemRarities.length - 1);
  if (ranks.includes(magicItemRarities.length - 1) && ranks.length === 1) return direction === "asc" ? 999 : -999;
  return direction === "asc" ? Math.min(...ranks) : Math.max(...ranks);
}

function openExternalUrl(url: string): void {
  if (typeof globalThis.chrome !== "undefined") {
    void chrome.runtime.sendMessage({ type: "DD55_OPEN_EXTERNAL", url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function normalizeCopiedContent(value: string): string {
  const [introduction = "", ...items] = value.trim().split(/\s*•\s*/);
  const normalizedIntroduction = introduction.replace(/\s+/g, " ").trim();
  const normalizedItems = items.map(item => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  return [normalizedIntroduction, ...normalizedItems.map(item => `• ${item}`)].filter(Boolean).join("\n");
}

function serializeSection(heading: string | undefined, content: string): string {
  return [heading?.trim(), normalizeCopiedContent(content)].filter(Boolean).join("\n");
}

function serializeEntrySection(entry: CompendiumEntry, heading: string | undefined, content: string): string {
  if (!entry.monster || !heading || !["Actions", "Actions Bonus", "Réactions", "Actions Légendaires"].includes(heading)) {
    return serializeSection(heading, content);
  }
  const actionHeading = heading as MonsterActionSection;
  return [
    heading,
    entry.monster.actionIntroductions[actionHeading],
    ...entry.monster.actions.filter(action => action.section === actionHeading).map(action => `${action.name}. ${action.description}`)
  ].filter(Boolean).join("\n");
}

function serializeTable(table: CompendiumTable): string {
  return [table.title, table.headers.join("\t"), ...table.rows.map(row => row.join("\t"))].join("\n");
}

function serializeEntry(entry: CompendiumEntry): string {
  const metadata = Object.entries(entry.meta).filter(([, value]) => value).map(([label, value]) => `${label} : ${value}`);
  if (entry.monster) metadata.push(`Caractéristiques : ${Object.entries(entry.monster.abilities).map(([name, ability]) => `${name} ${ability.score} (${ability.modifier}), JS ${ability.save}`).join(" · ")}`);
  const presentation = entry.sections[0]?.heading === "Présentation" ? entry.sections[0] : undefined;
  const articleSections = presentation ? entry.sections.slice(1) : entry.sections;
  const blocks = [
    entry.title,
    entry.subtitle,
    metadata.join("\n"),
    presentation ? serializeSection(presentation.heading, presentation.content) : "",
    ...(entry.tables ?? []).map(serializeTable),
    ...articleSections.map(section => serializeEntrySection(entry, section.heading, section.content)),
    `Source : SRD 5.2.1 FR, page ${entry.page} · CC BY 4.0`
  ];
  return blocks.filter(block => block.trim()).join("\n\n");
}

async function writeClipboardText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Le presse-papiers peut être refusé dans certaines fenêtres Roll20 détachées.
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function renderCopyButton(target: string, label = "Copier"): string {
  return `<button type="button" class="dd55-copy-button" data-copy-target="${escapeHtml(target)}" aria-label="${escapeHtml(label)}"><span aria-hidden="true">⧉</span><span data-copy-label>Copier</span></button>`;
}

function renderPresentation(entry: CompendiumEntry, content: string, copyTarget: string): string {
  if (entry.type !== "class") {
    return `<section class="dd55-presentation"><div class="dd55-section-bar"><div class="dd55-section-kicker">Présentation</div>${renderCopyButton(copyTarget, "Copier la présentation")}</div><div class="dd55-presentation-copy"><span aria-hidden="true">✦</span><p>${escapeHtml(content)}</p></div></section>`;
  }
  const withoutTitle = content.replace(new RegExp(`^Devenir ${entry.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}…?\\s*`, "i"), "");
  const [levelOne = "", multiclass = ""] = withoutTitle.split(/En tant que personnage multiclassé/i);
  const cards = [
    { icon: "1", title: "Personnage de niveau 1", text: levelOne.replace(/^En tant que personnage de niveau 1\s*/i, "") },
    { icon: "+", title: "Personnage multiclassé", text: multiclass }
  ].filter(card => card.text.trim()).map(card => {
    const items = card.text.split("•").map(item => item.trim()).filter(Boolean);
    return `<div class="dd55-start-card"><span class="dd55-start-icon" aria-hidden="true">${card.icon}</span><div><h4>${card.title}</h4>${items.length > 1 || card.text.includes("•") ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${escapeHtml(card.text.trim())}</p>`}</div></div>`;
  }).join("");
  return `<section class="dd55-presentation"><div class="dd55-section-bar"><div class="dd55-section-kicker">Présentation</div>${renderCopyButton(copyTarget, "Copier la présentation")}</div><div class="dd55-section-title"><div><h3>Commencer comme ${escapeHtml(entry.title)}</h3><p>Les éléments reçus lors de la création du personnage.</p></div></div><div class="dd55-start-grid">${cards}</div></section>`;
}

function renderCompendiumTable(table: CompendiumTable, entry: CompendiumEntry, copyTarget: string): string {
  const headers = table.headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join("");
  const rows = table.rows.map(row => `<tr class="${row[2] && row[2] !== "—" ? "has-feature" : ""}">${row.map((cell, index) => index === 0
    ? `<th scope="row">${escapeHtml(cell)}</th>`
    : `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  if (entry.type === "class" || entry.type === "subclass") return `<section class="dd55-progression"><div class="dd55-section-bar"><div class="dd55-section-kicker">Progression</div>${renderCopyButton(copyTarget, "Copier le tableau de progression")}</div><div class="dd55-progression-heading"><div><h3>Progression du ${escapeHtml(entry.title)}</h3><p>Aptitudes et ressources acquises du niveau 1 au niveau 20.</p></div><span>${table.rows.length}<small>niveaux</small></span></div><div class="dd55-table-hint"><span>↔ Faites défiler le tableau horizontalement</span><span><abbr title="Bonus de maîtrise">BM</abbr> : bonus de maîtrise · <abbr title="Emplacement">Empl.</abbr> : emplacement</span></div><div class="dd55-table-scroll" tabindex="0" aria-label="${escapeHtml(table.title)}"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  return `<section class="dd55-progression dd55-options-table"><div class="dd55-section-bar"><div class="dd55-section-kicker">Choix d’origine</div>${renderCopyButton(copyTarget, "Copier le tableau d’options")}</div><div class="dd55-progression-heading"><div><h3>${escapeHtml(table.title)}</h3><p>Comparez les options disponibles avant de faire votre choix.</p></div></div><div class="dd55-table-hint"><span>↔ Faites défiler le tableau horizontalement</span></div><div class="dd55-table-scroll" tabindex="0" aria-label="${escapeHtml(table.title)}"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

const paragraphStarters = /^(?:Vous|Votre|Vos|Le|La|Les|Un|Une|Des|Ce|Cet|Cette|Ces|Il|Ils|Elle|Elles|Chaque|Lorsque|Si|En|Tant|Pour|Par|Après|Avant|Au|Aux|Dans|Sur|Avec|Sans)\b/i;

function sentences(value: string): string[] {
  return value.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [];
}

function isInlineHeading(sentence: string): boolean {
  const label = sentence.replace(/[.!?]+$/, "").trim();
  return label.length <= 48 && label.split(/\s+/).length <= 7 && !paragraphStarters.test(label) && !/[,:;]/.test(label);
}

function renderParagraphs(value: string): string {
  const chunks = sentences(value);
  const output: string[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${escapeHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  for (let index = 0; index < chunks.length; index++) {
    const current = chunks[index];
    if (isInlineHeading(current) && index + 1 < chunks.length) {
      flushParagraph();
      const description: string[] = [];
      while (index + 1 < chunks.length && !isInlineHeading(chunks[index + 1])) description.push(chunks[++index]);
      output.push(`<div class="dd55-rule-point"><strong>${escapeHtml(current.replace(/[.!?]+$/, ""))}</strong><p>${escapeHtml(description.join(" "))}</p></div>`);
      continue;
    }
    paragraph.push(current);
    if (paragraph.join(" ").length >= 300 || paragraph.length >= 3) flushParagraph();
  }
  flushParagraph();
  return output.join("");
}

function renderProse(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized.includes("•")) return `<div class="dd55-prose">${renderParagraphs(normalized)}</div>`;
  const [introduction, ...rawItems] = normalized.split(/\s*•\s*/);
  let tail = "";
  const items = rawItems.map((item, index) => {
    if (index !== rawItems.length - 1) return item.trim();
    const itemSentences = sentences(item);
    if (itemSentences.length > 1 && /^(?:Chaque fois|Après|Lorsque|Ces|Cette|Vous pouvez|Le |La )/.test(itemSentences[1])) {
      tail = itemSentences.slice(1).join(" ");
      return itemSentences[0];
    }
    return item.trim();
  }).filter(Boolean);
  return `<div class="dd55-prose">${renderParagraphs(introduction)}<ul class="dd55-bullets">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${tail ? renderParagraphs(tail) : ""}</div>`;
}

function renderActionsRule(content: string): string {
  const actionNames = ["Attaque", "Désengagement", "Esquive", "Étude", "Furtivité", "Influence", "Intention", "Magie", "Observation", "Pointe", "Soutien", "Utilisation"];
  const tableStart = content.indexOf(" Actions Action Résumé ");
  const outroStart = content.indexOf(" Personnages-joueurs et monstres");
  if (tableStart < 0 || outroStart < 0) return renderProse(content);
  const introduction = content.slice(0, tableStart);
  const tableText = content.slice(tableStart + " Actions Action Résumé ".length, outroStart).replace("Action Résumé ", "");
  const rows: Array<{ name: string; description: string }> = [];
  for (let index = 0; index < actionNames.length; index++) {
    const name = actionNames[index];
    const start = tableText.indexOf(`${name} `);
    if (start < 0) continue;
    const nextStarts = actionNames.slice(index + 1).map(next => tableText.indexOf(` ${next} `, start + name.length)).filter(position => position >= 0);
    const end = nextStarts.length ? Math.min(...nextStarts) : tableText.length;
    rows.push({ name, description: tableText.slice(start + name.length + 1, end).trim() });
  }
  const outro = content.slice(outroStart + 1);
  const subheading = "Une chose à la fois";
  const subheadingStart = outro.indexOf(subheading);
  const outroLead = subheadingStart >= 0 ? outro.slice(0, subheadingStart) : outro;
  const outroEnd = subheadingStart >= 0 ? outro.slice(subheadingStart + subheading.length).trim() : "";
  return `<div class="dd55-prose">${renderParagraphs(introduction)}<dl class="dd55-action-grid">${rows.map(row => `<div class="dd55-action-item"><dt>${escapeHtml(row.name)}</dt><dd>${escapeHtml(row.description)}</dd></div>`).join("")}</dl>${renderParagraphs(outroLead)}${outroEnd ? `<h4>${subheading}</h4>${renderParagraphs(outroEnd)}` : ""}</div>`;
}

function renderSectionContent(entry: CompendiumEntry, content: string): string {
  return entry.id === "rule-actions" ? renderActionsRule(content) : renderProse(content);
}

function renderMonsterActionSection(entry: CompendiumEntry, heading: MonsterActionSection, targets: Map<string, MonsterRollTarget>): string | undefined {
  if (!entry.monster) return undefined;
  const actions = entry.monster.actions.filter(action => action.section === heading);
  if (!actions.length) return undefined;
  const introduction = entry.monster.actionIntroductions[heading];
  const cards = actions.map(action => {
    const rollable = isMonsterActionRollable(entry.monster!, action);
    if (rollable) targets.set(action.id, { entry, action });
    const rollButton = rollable
      ? `<button type="button" class="dd55-monster-roll" data-monster-roll-action="${escapeHtml(action.id)}" aria-label="Préparer ${escapeHtml(action.name)} dans le chat Roll20" title="Préremplir le chat Roll20 ou copier la macro"><span aria-hidden="true">⚄</span><span data-roll-label>Roll20</span></button>`
      : "";
    return `<article class="dd55-monster-action${rollButton ? " is-rollable" : ""}"><div class="dd55-monster-action-heading"><h4>${escapeHtml(action.name)}</h4>${rollButton}</div><div class="dd55-monster-action-content">${renderParagraphs(action.description)}</div></article>`;
  }).join("");
  return `${introduction ? `<div class="dd55-monster-action-intro">${renderParagraphs(introduction)}</div>` : ""}<div class="dd55-monster-actions">${cards}</div>`;
}

export function mountPanel(preferences: Preferences, onChange: (next: Partial<Preferences>) => void, onLauncherChange?: (next: Partial<Preferences>) => void): void {
  if (document.querySelector("#dd55-companion")) return;
  let currentPreferences: Preferences = {
    theme: "light", fontSize: "normal", resultDensity: "comfortable", defaultCategory: "",
    expandedByDefault: false, monsterRollMode: "two", autoRollMonsterActions: false, launcherVisible: true, ...preferences
  };
  let activeType = (currentPreferences.defaultCategory || undefined) as CompendiumFilter | undefined;
  let currentQuery = "";
  let activeSpellClass = "";
  let activeSpellLevel = "";
  let activeEquipmentType = "";
  let activeWeaponMastery = "";
  let activeOriginKind: "" | "species" | "background" = "";
  let activeRuleKind = "";
  let activeClassKind: "" | "class" | "subclass" = "class";
  let activeFeatCategory = "";
  let activeFeatSource = "";
  const activeMagicItemRarities = new Set<MagicItemRarity>();
  let activeMagicItemSort: MagicItemSort = "name";
  let activeMonsterType = "";
  let activeMonsterFpMin = "";
  let activeMonsterFpMax = "";
  let activeMonsterSize = "";
  let activeMonsterCategory = "";
  let activeMonsterAlignment = "";
  let activeMonsterMovement = "";
  let activeMonsterLegendary = "";
  let activeMonsterCaMin = "";
  let activeMonsterCaMax = "";
  let activeMonsterHpMin = "";
  let activeMonsterHpMax = "";
  let displayLimit = 80;
  let listRendered = false;
  let viewBeforeSettings: "home" | "detail" = "home";
  let scrollBeforeSettings = 0;
  let copyTargets = new Map<string, string>();
  let monsterRollTargets = new Map<string, MonsterRollTarget>();
  const copyFeedbackTimers = new WeakMap<HTMLElement, number>();
  let copyStatusTimer: number | undefined;

  const launcher = document.createElement("button");
  launcher.id = "dd55-launcher"; launcher.type = "button"; launcher.textContent = "📖 D&D 5.5 FR"; launcher.setAttribute("aria-expanded", "false");
  launcher.title = "Ouvrir le compendium · déplacer par glisser-déposer";
  launcher.hidden = currentPreferences.launcherVisible === false;
  const panel = document.createElement("aside"); panel.id = "dd55-companion"; panel.hidden = true;
  panel.innerHTML = `<header><div><strong>Compendium D&D 5.5 FR</strong><small>SRD 5.2.1 · hors ligne</small></div><button type="button" data-close aria-label="Fermer">×</button></header><div data-home><div class="dd55-search-wrap"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg><input data-search type="search" placeholder="Rechercher une règle, une origine, un sort, une arme…" aria-label="Recherche dans le compendium"><button type="button" data-clear-search aria-label="Effacer la recherche" hidden>×</button></div><nav class="dd55-tabs" aria-label="Catégories"><button type="button" data-type="">Tout <small>${totalReferenceCount}</small></button><button type="button" data-type="rule">Règles <small>${compendiumEntries.filter(e => e.type === "rule").length}</small></button><button type="button" data-type="classes">Classes <small>${compendiumEntries.filter(e => e.type === "class" || e.type === "subclass").length}</small></button><button type="button" data-type="origins">Origines <small>${compendiumEntries.filter(e => e.type === "species" || e.type === "background").length}</small></button><button type="button" data-type="equipment">Équipement <small>${compendiumEntries.filter(e => e.type === "equipment").length}</small></button><button type="button" data-type="spell">Sorts <small>${spellReferenceCount}</small></button><button type="button" data-type="feat">Dons <small>${featReferenceCount}</small></button></nav><div class="dd55-spell-filters" data-rule-filters hidden><div><span>Filtrer les règles</span><button type="button" data-clear-rule-filters hidden>Effacer</button></div><div class="dd55-filter-fields dd55-filter-single"><label><span>Type de règle</span><select data-rule-kind><option value="">Tous les types</option>${ruleKinds.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label></div></div><div class="dd55-spell-filters" data-class-filters hidden><div><span>Filtrer les classes</span></div><div class="dd55-filter-fields dd55-filter-single"><label><span>Type de fiche</span><select data-class-kind><option value="class" selected>Classes seulement</option><option value="subclass">Sous-classes seulement</option><option value="">Classes et sous-classes</option></select></label></div></div><div class="dd55-spell-filters" data-spell-filters hidden><div><span>Filtrer les sorts</span><button type="button" data-clear-spell-filters hidden>Effacer</button></div><div class="dd55-filter-fields"><label><span>Classe</span><select data-spell-class><option value="">Toutes les classes</option>${spellClassNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label><label><span>Niveau</span><select data-spell-level><option value="">Tous les niveaux</option>${spellLevels.map(level => `<option value="${level}">${level === "Mineur" ? "Sort mineur" : `Niveau ${level}`}</option>`).join("")}</select></label></div></div><div class="dd55-spell-filters" data-origin-filters hidden><div><span>Filtrer les origines</span><button type="button" data-clear-origin-filters hidden>Effacer</button></div><div class="dd55-filter-fields dd55-filter-single"><label><span>Type d’origine</span><select data-origin-kind><option value="">Espèces et historiques</option><option value="species">Espèces seulement</option><option value="background">Historiques seulement</option></select></label></div></div><div class="dd55-spell-filters" data-equipment-filters hidden><div><span>Filtrer l’équipement</span><button type="button" data-clear-equipment-filters hidden>Effacer</button></div><div class="dd55-filter-fields"><label><span>Type</span><select data-equipment-type><option value="">Tous les types</option>${equipmentTypes.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label><label><span>Maîtrise d’arme</span><select data-weapon-mastery><option value="">Toutes les bottes</option>${weaponMasteries.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label></div></div><div class="dd55-result-heading"><strong data-result-title>Tout le compendium</strong><span data-result-count role="status" aria-live="polite"></span></div><div data-results class="dd55-entry-list"></div></div><section data-settings class="dd55-settings-page" hidden><div class="dd55-settings-toolbar"><button type="button" data-settings-back>← Retour</button><h2>Réglages</h2></div><div class="dd55-settings-content"><fieldset><legend>Traduction</legend><label class="dd55-switch"><span><strong>Traduire la feuille</strong><small>Traduit et enrichit la feuille D&D 2024.</small></span><input type="checkbox" data-enabled ${currentPreferences.enabled ? "checked" : ""}></label><label class="dd55-switch"><span><strong>Conserver les noms anglais</strong><small>Affiche le nom original avec sa traduction.</small></span><input type="checkbox" data-bilingual ${currentPreferences.bilingual ? "checked" : ""}></label></fieldset><fieldset><legend>Affichage</legend><label>Thème<select data-setting-theme><option value="light">Clair</option><option value="dark">Sombre</option></select></label><label>Taille du texte<select data-setting-font-size><option value="small">Petite</option><option value="normal">Normale</option><option value="large">Grande</option></select></label><label>Densité des résultats<select data-setting-density><option value="comfortable">Confortable</option><option value="compact">Compacte</option></select></label></fieldset><fieldset><legend>Comportement</legend><label>Catégorie au démarrage<select data-default-category><option value="">Tout</option><option value="rule">Règles</option><option value="classes">Classes</option><option value="origins">Origines</option><option value="equipment">Équipement</option><option value="spell">Sorts</option><option value="feat">Dons</option></select></label><label class="dd55-switch"><span><strong>Ouvrir en grand</strong><small>Agrandit automatiquement le compendium à son ouverture.</small></span><input type="checkbox" data-expanded-default ${currentPreferences.expandedByDefault ? "checked" : ""}></label><label class="dd55-switch"><span><strong>Afficher le lanceur</strong><small>S’il est masqué, utilisez l’icône de l’extension pour le réafficher.</small></span><input type="checkbox" data-launcher-visible ${currentPreferences.launcherVisible !== false ? "checked" : ""}></label></fieldset><fieldset><legend>Positions</legend><p>Vous pouvez déplacer le panneau par son en-tête et le lanceur par glisser-déposer.</p><button type="button" data-reset-panel>Rétablir la position du compendium</button><button type="button" data-reset-launcher>Rétablir la position du lanceur</button></fieldset></div></section><article data-detail hidden></article><footer>Contenu local issu du SRD 5.2.1 FR · CC BY 4.0.<details><summary>Attribution et licence</summary>Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible sur <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">D&D Beyond</a>, sous <a href="https://creativecommons.org/licenses/by/4.0/legalcode.fr" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</details></footer>`;
  panel.querySelector<HTMLInputElement>("[data-expanded-default]")!.closest("label")!.insertAdjacentHTML("afterend", `<label>Mode des jets d’attaque<select data-monster-roll-mode><option value="two">Toujours lancer deux dés</option><option value="single">Lancer un seul dé</option><option value="ask">Demander à chaque jet</option></select></label><label class="dd55-switch"><span><strong>Lancer automatiquement les jets</strong><small>Envoie immédiatement la carte privée au MJ quand le chat Roll20 est disponible et vide.</small></span><input type="checkbox" data-auto-roll-monsters ${currentPreferences.autoRollMonsterActions ? "checked" : ""}></label>`);
  panel.querySelector<HTMLSelectElement>("[data-monster-roll-mode]")!.value = currentPreferences.monsterRollMode ?? "two";
  panel.querySelector(".dd55-tabs")!.insertAdjacentHTML("beforeend", `<button type="button" data-type="magic-item">Objets magiques <small>${magicItemReferenceCount}</small></button>`);
  panel.querySelector(".dd55-tabs")!.insertAdjacentHTML("beforeend", `<button type="button" data-type="monster">Monstres <small>${monsterEntries.length}</small></button>`);
  panel.querySelectorAll<HTMLButtonElement>(".dd55-tabs button").forEach(button => {
    const labelNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    if (!labelNode) return;
    const label = document.createElement("span");
    label.className = "dd55-tab-label";
    label.textContent = labelNode.textContent?.trim() ?? "";
    button.replaceChild(label, labelNode);
    label.after(document.createTextNode(" "));
  });
  panel.querySelector<HTMLElement>("[data-spell-filters]")!.insertAdjacentHTML("afterend", `<div class="dd55-spell-filters" data-feat-filters hidden><div><span>Filtrer les dons</span><button type="button" data-clear-feat-filters hidden>Effacer</button></div><div class="dd55-filter-fields"><label><span>Type de don</span><select data-feat-category><option value="">Tous les types</option>${featCategories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(featCategoryLabels[category])}</option>`).join("")}</select></label><label><span>Source</span><select data-feat-source><option value="">Toutes les sources</option>${featSources.map(source => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("")}</select></label></div></div>`);
  panel.querySelector("[data-result-title]")!.parentElement!.insertAdjacentHTML("beforebegin", `<div class="dd55-spell-filters dd55-magic-item-filters" data-magic-item-filters hidden><div><span>Filtrer les objets magiques</span><button type="button" data-clear-magic-item-filters hidden>Effacer</button></div><div class="dd55-rarity-chips" aria-label="Raretés">${magicItemRarities.map(rarity => `<button type="button" data-magic-rarity="${rarity}" aria-pressed="false">${rarity}</button>`).join("")}</div><div class="dd55-filter-fields dd55-filter-single"><label><span>Tri</span><select data-magic-item-sort><option value="name">Nom A–Z</option><option value="rarity-asc">Rareté croissante</option><option value="rarity-desc">Rareté décroissante</option></select></label></div></div>`);
  panel.querySelector("[data-result-title]")!.parentElement!.insertAdjacentHTML("beforebegin", `<div class="dd55-spell-filters dd55-monster-filters" data-monster-filters hidden><div><span>Filtrer les monstres</span><button type="button" data-clear-monster-filters hidden>Tout effacer</button></div><div class="dd55-monster-basic"><label><span>Type</span><select data-monster-type><option value="">Tous les types</option>${monsterTypes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select></label><label><span>FP min</span><select data-monster-fp-min><option value="">Minimum</option>${monsterChallengeRatings.map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label><span>FP max</span><select data-monster-fp-max><option value="">Maximum</option>${monsterChallengeRatings.map(value => `<option value="${value}">${value}</option>`).join("")}</select></label></div><button type="button" class="dd55-advanced-toggle" data-monster-advanced-toggle aria-expanded="false"><span>Filtres avancés</span><small data-monster-advanced-count hidden></small><b aria-hidden="true">⌄</b></button><div class="dd55-monster-advanced" data-monster-advanced hidden><div class="dd55-filter-fields"><label><span>Taille</span><select data-monster-size><option value="">Toutes</option>${monsterSizes.map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label><span>Catégorie</span><select data-monster-category><option value="">Toutes</option><option value="Monstres de A à Z">Monstres de A à Z</option><option value="Animaux">Animaux</option></select></label><label><span>Alignement</span><select data-monster-alignment><option value="">Tous</option>${monsterAlignments.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select></label><label><span>Déplacement</span><select data-monster-movement><option value="">Tous</option>${monsterMovementModes.map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label><span>Légendaire</span><select data-monster-legendary><option value="">Tous</option><option value="yes">Oui seulement</option><option value="no">Non seulement</option></select></label></div><div class="dd55-monster-ranges"><fieldset><legend>Classe d’armure</legend><input type="number" min="0" inputmode="numeric" placeholder="Min" aria-label="CA minimale" data-monster-ca-min><span>à</span><input type="number" min="0" inputmode="numeric" placeholder="Max" aria-label="CA maximale" data-monster-ca-max></fieldset><fieldset><legend>Points de vie</legend><input type="number" min="0" inputmode="numeric" placeholder="Min" aria-label="Points de vie minimaux" data-monster-hp-min><span>à</span><input type="number" min="0" inputmode="numeric" placeholder="Max" aria-label="Points de vie maximaux" data-monster-hp-max></fieldset></div></div></div>`);
  panel.querySelector<HTMLInputElement>("[data-search]")!.placeholder = "Rechercher une règle, un sort, un objet, un monstre…";
  panel.querySelector<HTMLSelectElement>("[data-default-category]")!.insertAdjacentHTML("beforeend", `<option value="magic-item">Objets magiques</option>`);
  panel.querySelector<HTMLSelectElement>("[data-default-category]")!.insertAdjacentHTML("beforeend", `<option value="monster">Monstres</option>`);
  const closeButton = panel.querySelector<HTMLButtonElement>("[data-close]")!;
  const headerActions = document.createElement("div");
  headerActions.className = "dd55-header-actions";
  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.dataset.settingsOpen = "";
  settingsButton.setAttribute("aria-label", "Ouvrir les réglages");
  settingsButton.title = "Réglages";
  settingsButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4A2 2 0 0 0 4 9.9l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"/></svg>`;
  const expandButton = document.createElement("button");
  expandButton.type = "button";
  expandButton.dataset.expand = "";
  expandButton.setAttribute("aria-label", "Agrandir le compendium");
  expandButton.setAttribute("aria-pressed", "false");
  expandButton.title = "Agrandir le compendium";
  expandButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>`;
  closeButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>`;
  headerActions.append(settingsButton, expandButton, closeButton);
  panel.querySelector("header")!.append(headerActions);
  document.body.append(launcher, panel);

  const applyVisualPreferences = () => {
    panel.dataset.theme = currentPreferences.theme ?? "light";
    panel.dataset.fontSize = currentPreferences.fontSize ?? "normal";
    panel.dataset.density = currentPreferences.resultDensity ?? "comfortable";
  };
  const updatePreferences = (next: Partial<Preferences>) => {
    currentPreferences = { ...currentPreferences, ...next };
    applyVisualPreferences();
    onChange(next);
  };
  applyVisualPreferences();

  const askMonsterRollMode = (actionName: string, opener: HTMLElement): Promise<Exclude<MonsterAttackRollMode, "two"> | undefined> => new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "dd55-roll-mode-overlay";
    overlay.dataset.rollModeDialog = "";
    overlay.innerHTML = `<div class="dd55-roll-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="dd55-roll-mode-title"><div class="dd55-roll-mode-heading"><h3 id="dd55-roll-mode-title">Comment lancer l’attaque ?</h3><button type="button" data-roll-mode-cancel aria-label="Annuler">×</button></div><p>${escapeHtml(actionName)}</p><div class="dd55-roll-mode-options"><button type="button" data-roll-mode-choice="single"><strong>Normal</strong><small>1d20</small></button><button type="button" data-roll-mode-choice="advantage"><strong>Avantage</strong><small>2d20, meilleur résultat</small></button><button type="button" data-roll-mode-choice="disadvantage"><strong>Désavantage</strong><small>2d20, moins bon résultat</small></button></div></div>`;
    const finish = (choice?: Exclude<MonsterAttackRollMode, "two">) => {
      overlay.remove();
      if (!choice && opener.isConnected) opener.focus();
      resolve(choice);
    };
    overlay.addEventListener("click", event => {
      const choiceButton = (event.target as Element).closest<HTMLButtonElement>("[data-roll-mode-choice]");
      if (choiceButton?.dataset.rollModeChoice) {
        finish(choiceButton.dataset.rollModeChoice as Exclude<MonsterAttackRollMode, "two">);
        return;
      }
      if (event.target === overlay || (event.target as Element).closest("[data-roll-mode-cancel]")) finish();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish();
    });
    panel.append(overlay);
    overlay.querySelector<HTMLButtonElement>("[data-roll-mode-choice]")!.focus();
  });

  const placeLauncher = (left: number, top: number) => {
    const maxLeft = Math.max(0, window.innerWidth - launcher.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - launcher.offsetHeight);
    launcher.style.left = `${Math.min(Math.max(0, left), maxLeft)}px`;
    launcher.style.top = `${Math.min(Math.max(0, top), maxTop)}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
  };
  if (currentPreferences.launcherPosition) placeLauncher(currentPreferences.launcherPosition.left, currentPreferences.launcherPosition.top);

  const placePanel = (left: number, top: number) => {
    if (panel.classList.contains("is-expanded")) return;
    const width = panel.offsetWidth || Math.min(460, window.innerWidth - 36);
    const height = panel.offsetHeight || Math.min(760, window.innerHeight - 96);
    const margin = window.innerWidth <= 520 ? 8 : 18;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    panel.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
    panel.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };
  if (currentPreferences.panelPosition) placePanel(currentPreferences.panelPosition.left, currentPreferences.panelPosition.top);

  let dragged = false;
  let suppressClick = false;
  let dragStart = { x: 0, y: 0, left: 0, top: 0 };
  launcher.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const rect = launcher.getBoundingClientRect();
    dragged = false;
    dragStart = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener("pointermove", event => {
    if (!launcher.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (!dragged && Math.hypot(dx, dy) < 5) return;
    dragged = true;
    launcher.classList.add("is-dragging");
    placeLauncher(dragStart.left + dx, dragStart.top + dy);
  });
  launcher.addEventListener("pointerup", event => {
    if (!launcher.hasPointerCapture(event.pointerId)) return;
    launcher.releasePointerCapture(event.pointerId);
    launcher.classList.remove("is-dragging");
    if (!dragged) return;
    suppressClick = true;
    const rect = launcher.getBoundingClientRect();
    onLauncherChange?.({ launcherPosition: { left: Math.round(rect.left), top: Math.round(rect.top) } });
  });

  const panelHeader = panel.querySelector<HTMLElement>(":scope > header")!;
  let panelDragged = false;
  let panelDragStart = { x: 0, y: 0, left: 0, top: 0 };
  panelHeader.addEventListener("pointerdown", event => {
    if (event.button !== 0 || panel.classList.contains("is-expanded") || (event.target as Element).closest("button")) return;
    const rect = panel.getBoundingClientRect();
    panelDragged = false;
    panelDragStart = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    panelHeader.setPointerCapture(event.pointerId);
  });
  panelHeader.addEventListener("pointermove", event => {
    if (!panelHeader.hasPointerCapture(event.pointerId)) return;
    const dx = event.clientX - panelDragStart.x;
    const dy = event.clientY - panelDragStart.y;
    if (!panelDragged && Math.hypot(dx, dy) < 5) return;
    panelDragged = true;
    panel.classList.add("is-panel-dragging");
    placePanel(panelDragStart.left + dx, panelDragStart.top + dy);
  });
  const finishPanelDrag = (event: PointerEvent) => {
    if (!panelHeader.hasPointerCapture(event.pointerId)) return;
    panelHeader.releasePointerCapture(event.pointerId);
    panel.classList.remove("is-panel-dragging");
    if (!panelDragged) return;
    const rect = panel.getBoundingClientRect();
    const panelPosition = { left: Math.round(rect.left), top: Math.round(rect.top) };
    currentPreferences = { ...currentPreferences, panelPosition };
    onLauncherChange?.({ panelPosition });
  };
  panelHeader.addEventListener("pointerup", finishPanelDrag);
  panelHeader.addEventListener("pointercancel", finishPanelDrag);

  const home = panel.querySelector<HTMLElement>("[data-home]")!;
  const settings = panel.querySelector<HTMLElement>("[data-settings]")!;
  const results = panel.querySelector<HTMLElement>("[data-results]")!;
  const detail = panel.querySelector<HTMLElement>("[data-detail]")!;
  const search = panel.querySelector<HTMLInputElement>("[data-search]")!;
  const clearSearch = panel.querySelector<HTMLButtonElement>("[data-clear-search]")!;
  const spellFilters = panel.querySelector<HTMLElement>("[data-spell-filters]")!;
  const spellClass = panel.querySelector<HTMLSelectElement>("[data-spell-class]")!;
  const spellLevel = panel.querySelector<HTMLSelectElement>("[data-spell-level]")!;
  const clearSpellFilters = panel.querySelector<HTMLButtonElement>("[data-clear-spell-filters]")!;
  const originFilters = panel.querySelector<HTMLElement>("[data-origin-filters]")!;
  const originKind = panel.querySelector<HTMLSelectElement>("[data-origin-kind]")!;
  const clearOriginFilters = panel.querySelector<HTMLButtonElement>("[data-clear-origin-filters]")!;
  const equipmentFilters = panel.querySelector<HTMLElement>("[data-equipment-filters]")!;
  const equipmentType = panel.querySelector<HTMLSelectElement>("[data-equipment-type]")!;
  const weaponMastery = panel.querySelector<HTMLSelectElement>("[data-weapon-mastery]")!;
  const clearEquipmentFilters = panel.querySelector<HTMLButtonElement>("[data-clear-equipment-filters]")!;
  const ruleFilters = panel.querySelector<HTMLElement>("[data-rule-filters]")!;
  const ruleKind = panel.querySelector<HTMLSelectElement>("[data-rule-kind]")!;
  const clearRuleFilters = panel.querySelector<HTMLButtonElement>("[data-clear-rule-filters]")!;
  const featFilters = panel.querySelector<HTMLElement>("[data-feat-filters]")!;
  const featCategory = panel.querySelector<HTMLSelectElement>("[data-feat-category]")!;
  const featSource = panel.querySelector<HTMLSelectElement>("[data-feat-source]")!;
  const clearFeatFilters = panel.querySelector<HTMLButtonElement>("[data-clear-feat-filters]")!;
  const classFilters = panel.querySelector<HTMLElement>("[data-class-filters]")!;
  const classKind = panel.querySelector<HTMLSelectElement>("[data-class-kind]")!;
  const magicItemFilters = panel.querySelector<HTMLElement>("[data-magic-item-filters]")!;
  const magicItemSort = panel.querySelector<HTMLSelectElement>("[data-magic-item-sort]")!;
  const clearMagicItemFilters = panel.querySelector<HTMLButtonElement>("[data-clear-magic-item-filters]")!;
  const monsterFilters = panel.querySelector<HTMLElement>("[data-monster-filters]")!;
  const monsterType = panel.querySelector<HTMLSelectElement>("[data-monster-type]")!;
  const monsterFpMin = panel.querySelector<HTMLSelectElement>("[data-monster-fp-min]")!;
  const monsterFpMax = panel.querySelector<HTMLSelectElement>("[data-monster-fp-max]")!;
  const monsterSize = panel.querySelector<HTMLSelectElement>("[data-monster-size]")!;
  const monsterCategory = panel.querySelector<HTMLSelectElement>("[data-monster-category]")!;
  const monsterAlignment = panel.querySelector<HTMLSelectElement>("[data-monster-alignment]")!;
  const monsterMovement = panel.querySelector<HTMLSelectElement>("[data-monster-movement]")!;
  const monsterLegendary = panel.querySelector<HTMLSelectElement>("[data-monster-legendary]")!;
  const monsterCaMin = panel.querySelector<HTMLInputElement>("[data-monster-ca-min]")!;
  const monsterCaMax = panel.querySelector<HTMLInputElement>("[data-monster-ca-max]")!;
  const monsterHpMin = panel.querySelector<HTMLInputElement>("[data-monster-hp-min]")!;
  const monsterHpMax = panel.querySelector<HTMLInputElement>("[data-monster-hp-max]")!;
  const monsterAdvanced = panel.querySelector<HTMLElement>("[data-monster-advanced]")!;
  const monsterAdvancedToggle = panel.querySelector<HTMLButtonElement>("[data-monster-advanced-toggle]")!;
  const monsterAdvancedCount = panel.querySelector<HTMLElement>("[data-monster-advanced-count]")!;
  const clearMonsterFilters = panel.querySelector<HTMLButtonElement>("[data-clear-monster-filters]")!;

  panel.querySelector<HTMLSelectElement>("[data-setting-theme]")!.value = currentPreferences.theme ?? "light";
  panel.querySelector<HTMLSelectElement>("[data-setting-font-size]")!.value = currentPreferences.fontSize ?? "normal";
  panel.querySelector<HTMLSelectElement>("[data-setting-density]")!.value = currentPreferences.resultDensity ?? "comfortable";
  panel.querySelector<HTMLSelectElement>("[data-default-category]")!.value = currentPreferences.defaultCategory ?? "";

  const syncCategory = () => {
    spellFilters.hidden = activeType !== "spell";
    featFilters.hidden = activeType !== "feat";
    ruleFilters.hidden = activeType !== "rule";
    classFilters.hidden = activeType !== "classes";
    originFilters.hidden = activeType !== "origins";
    equipmentFilters.hidden = activeType !== "equipment";
    magicItemFilters.hidden = activeType !== "magic-item";
    monsterFilters.hidden = activeType !== "monster";
    panel.querySelectorAll<HTMLButtonElement>(".dd55-tabs button").forEach(button => {
      const selected = (button.dataset.type || undefined) === activeType;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  };
  syncCategory();

  const numericBound = (value: string): number | undefined => value === "" ? undefined : Number(value);
  const monsterAdvancedFilterCount = () => [
    activeMonsterSize, activeMonsterCategory, activeMonsterAlignment, activeMonsterMovement, activeMonsterLegendary,
    activeMonsterCaMin, activeMonsterCaMax, activeMonsterHpMin, activeMonsterHpMax
  ].filter(Boolean).length;
  const syncMonsterAdvanced = (expanded = !monsterAdvanced.hidden) => {
    monsterAdvanced.hidden = !expanded;
    monsterAdvancedToggle.setAttribute("aria-expanded", String(expanded));
    monsterAdvancedToggle.classList.toggle("is-open", expanded);
    const count = monsterAdvancedFilterCount();
    monsterAdvancedCount.hidden = count === 0;
    monsterAdvancedCount.textContent = count ? String(count) : "";
  };
  syncMonsterAdvanced(false);

  const renderList = () => {
    listRendered = true;
    let matchingResults = activeType === "classes"
      ? (activeClassKind
        ? searchCompendiumResults(currentQuery, activeClassKind, 1000)
        : [...searchCompendiumResults(currentQuery, "class", 1000), ...searchCompendiumResults(currentQuery, "subclass", 1000)].sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "fr")))
      : activeType === "origins"
        ? [...searchCompendiumResults(currentQuery, "species", 1000), ...searchCompendiumResults(currentQuery, "background", 1000)].sort((a, b) => b.score - a.score || a.entry.type.localeCompare(b.entry.type) || a.entry.title.localeCompare(b.entry.title, "fr"))
        : searchCompendiumResults(currentQuery, activeType, 1000);
    if (activeType === "spell") matchingResults = matchingResults.filter(({ entry }) =>
      (!activeSpellClass || entry.tags.includes(activeSpellClass)) &&
      (!activeSpellLevel || entry.meta.Niveau === activeSpellLevel)
    );
    if (activeType === "equipment") matchingResults = matchingResults.filter(({ entry }) =>
      (!activeEquipmentType || entry.meta["Type d’équipement"] === activeEquipmentType) &&
      (!activeWeaponMastery || entry.meta["Botte d’arme"] === activeWeaponMastery)
    );
    if (activeType === "origins" && activeOriginKind) matchingResults = matchingResults.filter(({ entry }) => entry.type === activeOriginKind);
    if (activeType === "rule" && activeRuleKind) matchingResults = matchingResults.filter(({ entry }) => (entry.meta.Catégorie || entry.subtitle) === activeRuleKind);
    if (activeType === "feat" && (activeFeatCategory || activeFeatSource)) matchingResults = matchingResults.filter(({ entry }) => {
      const reference = localFeatReferences.get(entry.id);
      return Boolean(reference &&
        (!activeFeatCategory || reference.category === activeFeatCategory) &&
        (!activeFeatSource || reference.source === activeFeatSource));
    });
    if (activeType === "magic-item" && activeMagicItemRarities.size) matchingResults = matchingResults.filter(({ entry }) =>
      (entry.rarities ?? []).some(rarity => activeMagicItemRarities.has(rarity))
    );
    if (activeType === "monster") matchingResults = matchingResults.filter(({ entry }) => {
      const monster = entry.monster;
      if (!monster) return false;
      const fpMin = activeMonsterFpMin ? monsterChallengeValues.get(activeMonsterFpMin) : undefined;
      const fpMax = activeMonsterFpMax ? monsterChallengeValues.get(activeMonsterFpMax) : undefined;
      const caMin = numericBound(activeMonsterCaMin); const caMax = numericBound(activeMonsterCaMax);
      const hpMin = numericBound(activeMonsterHpMin); const hpMax = numericBound(activeMonsterHpMax);
      return (!activeMonsterType || monster.creatureType === activeMonsterType)
        && (fpMin === undefined || monster.challengeValue >= fpMin)
        && (fpMax === undefined || monster.challengeValue <= fpMax)
        && (!activeMonsterSize || monster.sizes.includes(activeMonsterSize))
        && (!activeMonsterCategory || monster.category === activeMonsterCategory)
        && (!activeMonsterAlignment || monster.alignment === activeMonsterAlignment)
        && (!activeMonsterMovement || monster.movementModes.includes(activeMonsterMovement))
        && (!activeMonsterLegendary || monster.legendary === (activeMonsterLegendary === "yes"))
        && (caMin === undefined || monster.armorClass >= caMin) && (caMax === undefined || monster.armorClass <= caMax)
        && (hpMin === undefined || monster.hitPoints >= hpMin) && (hpMax === undefined || monster.hitPoints <= hpMax);
    });
    let externalMatches = activeType === "spell" && activeSpellClass ? [] : externalReferences(currentQuery, activeType);
    if (activeType === "spell" && activeSpellLevel) {
      const wantedLevel = activeSpellLevel === "Mineur" ? 0 : Number(activeSpellLevel);
      externalMatches = externalMatches.filter(({ item }) => item.level === wantedLevel);
    }
    if (activeType === "feat" && (activeFeatCategory || activeFeatSource)) externalMatches = externalMatches.filter(({ item }) =>
      (!activeFeatCategory || item.category === activeFeatCategory) &&
      (!activeFeatSource || item.source === activeFeatSource)
    );
    if (activeType === "magic-item" && activeMagicItemRarities.size) externalMatches = externalMatches.filter(({ item }) =>
      ((item as MagicItemReference).rarities ?? []).some(rarity => activeMagicItemRarities.has(rarity))
    );
    const resultCount = matchingResults.length + externalMatches.length;
    panel.querySelector<HTMLElement>("[data-result-title]")!.textContent = currentQuery ? `Résultats pour « ${currentQuery} »` : activeType === "classes" ? activeClassKind === "class" ? "Classes du SRD" : activeClassKind === "subclass" ? "Sous-classes du SRD" : "Classes et sous-classes" : activeType === "origins" ? "Espèces et historiques" : activeType === "feat" ? "Dons du compendium" : activeType === "spell" ? "Sorts du compendium" : activeType === "equipment" ? "Équipement du SRD" : activeType === "magic-item" ? "Objets magiques" : activeType === "monster" ? "Monstres du DRS" : activeType ? `${typeLabels[activeType]}s du SRD` : "Tout le compendium";
    panel.querySelector<HTMLElement>("[data-result-count]")!.textContent = `${resultCount} référence${resultCount > 1 ? "s" : ""}`;
    clearSpellFilters.hidden = !(activeSpellClass || activeSpellLevel);
    clearOriginFilters.hidden = !activeOriginKind;
    clearEquipmentFilters.hidden = !(activeEquipmentType || activeWeaponMastery);
    clearRuleFilters.hidden = !activeRuleKind;
    clearFeatFilters.hidden = !(activeFeatCategory || activeFeatSource);
    clearMagicItemFilters.hidden = !activeMagicItemRarities.size && activeMagicItemSort === "name";
    clearMonsterFilters.hidden = !(activeMonsterType || activeMonsterFpMin || activeMonsterFpMax || monsterAdvancedFilterCount());
    syncMonsterAdvanced();
    clearSearch.hidden = !currentQuery;
    let cards = [
      ...matchingResults.map(result => ({ title: result.entry.title, score: result.score, local: true, rarities: result.entry.rarities, html: renderEntryCard(result, currentQuery) })),
      ...externalMatches.map(reference => ({ title: reference.item.nameFr, score: reference.score, local: false, rarities: reference.kind === "magic-item" ? (reference.item as MagicItemReference).rarities : undefined, html: renderExternalCard(reference, currentQuery) }))
    ];
    if (activeType === "magic-item") cards.sort((a, b) => {
      if (activeMagicItemSort === "name") return a.title.localeCompare(b.title, "fr");
      const direction = activeMagicItemSort === "rarity-asc" ? "asc" : "desc";
      const left = raritySortValue(a.rarities, direction);
      const right = raritySortValue(b.rarities, direction);
      return (direction === "asc" ? left - right : right - left) || a.title.localeCompare(b.title, "fr");
    });
    else if (currentQuery) cards.sort((a, b) => b.score - a.score || Number(b.local) - Number(a.local) || a.title.localeCompare(b.title, "fr"));
    else if (activeType === "feat" || activeType === "spell" || activeType === "monster") cards.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    const maximum = displayLimit;
    const remaining = Math.max(0, cards.length - maximum);
    cards = cards.slice(0, maximum);
    const hasFilters = Boolean(activeSpellClass || activeSpellLevel || activeEquipmentType || activeWeaponMastery || activeOriginKind || activeRuleKind || activeFeatCategory || activeFeatSource || activeMagicItemRarities.size || activeMagicItemSort !== "name" || activeMonsterType || activeMonsterFpMin || activeMonsterFpMax || monsterAdvancedFilterCount() || (activeType === "classes" && activeClassKind !== ""));
    results.innerHTML = cards.map(card => card.html).join("") || `<div class="dd55-empty"><strong>Aucune fiche trouvée</strong><p>${currentQuery ? `Aucun résultat pour « ${escapeHtml(currentQuery)} »${hasFilters ? " avec les filtres actifs" : ""}.` : "Aucune référence ne correspond aux filtres actifs."}</p><div>${currentQuery ? `<button type="button" data-empty-clear-search>Effacer la recherche</button>` : ""}${hasFilters ? `<button type="button" data-empty-reset-filters>Réinitialiser les filtres</button>` : ""}</div></div>`;
    if (remaining) results.insertAdjacentHTML("beforeend", `<button type="button" class="dd55-load-more" data-load-more>Afficher ${Math.min(80, remaining)} références de plus <small>${remaining} restantes</small></button>`);
  };

  const showEntry = (entry: CompendiumEntry) => {
    home.hidden = true; settings.hidden = true; detail.hidden = false;
    const monsterPrimaryKeys = new Set(["Type", "Taille", "Alignement", "CA", "Initiative", "Points de vie", "Vitesse", "FP"]);
    const metadata = Object.entries(entry.meta).filter(([label, value]) => value && (!entry.monster || !monsterPrimaryKeys.has(label))).map(([label, value]) => `<div class="${value.length > 85 ? "is-wide" : ""}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    const monsterBlock = entry.monster ? `<section class="dd55-monster-statblock"><div class="dd55-monster-combat"><div><span>CA</span><strong>${escapeHtml(entry.meta.CA)}</strong></div><div><span>Initiative</span><strong>${escapeHtml(entry.meta.Initiative)}</strong></div><div><span>Points de vie</span><strong>${escapeHtml(entry.meta["Points de vie"])}</strong></div><div><span>Vitesse</span><strong>${escapeHtml(entry.meta.Vitesse)}</strong></div></div><div class="dd55-monster-abilities" aria-label="Caractéristiques">${Object.entries(entry.monster.abilities).map(([name, ability]) => `<div><span>${name}</span><strong>${ability.score}</strong><small>${escapeHtml(ability.modifier)} · JS ${escapeHtml(ability.save)}</small></div>`).join("")}</div><p class="dd55-monster-category">${escapeHtml(entry.monster.category)}${entry.monster.legendary ? " · Créature légendaire" : ""}</p></section>` : "";
    const mastery = entry.type === "equipment" && entry.meta["Botte d’arme"] ? compendiumEntries.find(candidate => candidate.id === `rule-botte-${normalizeName(entry.meta["Botte d’arme"]).replace(/\s+/g, "-")}`) : undefined;
    const subclass = entry.type === "class" ? compendiumEntries.find(candidate => candidate.type === "subclass" && candidate.meta["Classe parente"] === entry.title) : undefined;
    const directLinks = [
      ...(entry.links ?? []).map(link => ({ ...link, entry: compendiumEntries.find(candidate => candidate.id === link.entryId) })),
      ...(mastery ? [{ label: "Botte d’arme", entryId: mastery.id, title: mastery.title, entry: mastery }] : []),
      ...(subclass ? [{ label: "Sous-classe du SRD", entryId: subclass.id, title: subclass.title, entry: subclass }] : [])
    ].filter(link => link.entry);
    const entryLinks = directLinks.map(link => `<aside class="dd55-mastery-link"><span>${escapeHtml(link.label)}</span><button type="button" data-entry-id="${link.entryId}"><strong>${escapeHtml(link.title)}</strong><small>Ouvrir la fiche complète</small><b>›</b></button></aside>`).join("");
    copyTargets = new Map<string, string>();
    monsterRollTargets = new Map<string, MonsterRollTarget>();
    copyTargets.set("all", serializeEntry(entry));
    const presentationSection = entry.sections[0]?.heading === "Présentation" ? entry.sections[0] : undefined;
    if (presentationSection) copyTargets.set("presentation", serializeSection(presentationSection.heading, presentationSection.content));
    const presentation = presentationSection ? renderPresentation(entry, presentationSection.content, "presentation") : "";
    const articleSections = presentation ? entry.sections.slice(1) : entry.sections;
    const tables = entry.tables?.map((table, index) => {
      const target = `table-${index}`;
      copyTargets.set(target, serializeTable(table));
      return renderCompendiumTable(table, entry, target);
    }).join("") ?? "";
    const sections = articleSections.map((section, index) => {
      const target = `section-${index}`;
      copyTargets.set(target, serializeEntrySection(entry, section.heading, section.content));
      const monsterSection = section.heading && ["Actions", "Actions Bonus", "Réactions", "Actions Légendaires"].includes(section.heading)
        ? renderMonsterActionSection(entry, section.heading as MonsterActionSection, monsterRollTargets)
        : undefined;
      return `<section class="dd55-copyable-section"><div class="dd55-article-heading">${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : "<span></span>"}${renderCopyButton(target, `Copier ${section.heading ? `la section ${section.heading}` : "ce bloc"}`)}</div>${monsterSection ?? renderSectionContent(entry, section.content)}</section>`;
    }).join("");
    const related = compendiumEntries.filter(candidate => candidate.id !== entry.id && candidate.type === entry.type && candidate.tags.some(tag => entry.tags.includes(tag))).slice(0, 6);
    detail.innerHTML = `<div class="dd55-detail-toolbar"><button type="button" data-back>← Compendium</button><div><span>Page SRD ${entry.page}</span>${renderCopyButton("all", "Copier toute la fiche")}</div></div><p class="dd55-copy-status" data-copy-status role="status" aria-live="polite"></p><div class="dd55-detail-hero" data-kind="${entry.type}"><span>${typeLabels[entry.type]}</span><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.subtitle)}</p></div>${monsterBlock}${metadata ? `<dl class="dd55-meta-grid">${metadata}</dl>` : ""}${entryLinks}${presentation}${tables}<div class="dd55-article">${sections}</div>${related.length ? `<aside class="dd55-related"><h3>À découvrir aussi</h3>${related.map(item => `<button type="button" data-entry-id="${item.id}">${escapeHtml(item.title)}<span>›</span></button>`).join("")}</aside>` : ""}<p class="dd55-source">Source : SRD 5.2.1 FR, page ${entry.page} · CC BY 4.0</p>`;
    panel.scrollTop = 0;
  };

  const resetMonsterFilters = () => {
    activeMonsterType = ""; activeMonsterFpMin = ""; activeMonsterFpMax = ""; activeMonsterSize = ""; activeMonsterCategory = "";
    activeMonsterAlignment = ""; activeMonsterMovement = ""; activeMonsterLegendary = ""; activeMonsterCaMin = ""; activeMonsterCaMax = ""; activeMonsterHpMin = ""; activeMonsterHpMax = "";
    [monsterType, monsterFpMin, monsterFpMax, monsterSize, monsterCategory, monsterAlignment, monsterMovement, monsterLegendary].forEach(control => { control.value = ""; });
    [monsterCaMin, monsterCaMax, monsterHpMin, monsterHpMax].forEach(control => { control.value = ""; });
    syncMonsterAdvanced(false);
  };

  const resetFilters = () => {
    activeSpellClass = ""; activeSpellLevel = ""; spellClass.value = ""; spellLevel.value = "";
    activeOriginKind = ""; originKind.value = "";
    activeEquipmentType = ""; activeWeaponMastery = ""; equipmentType.value = ""; weaponMastery.value = "";
    activeRuleKind = ""; ruleKind.value = "";
    activeFeatCategory = ""; activeFeatSource = ""; featCategory.value = ""; featSource.value = "";
    activeClassKind = ""; classKind.value = "";
    activeMagicItemRarities.clear(); activeMagicItemSort = "name"; magicItemSort.value = "name";
    magicItemFilters.querySelectorAll<HTMLButtonElement>("[data-magic-rarity]").forEach(button => { button.classList.remove("is-active"); button.setAttribute("aria-pressed", "false"); });
    resetMonsterFilters();
    displayLimit = 80;
    renderList();
  };

  results.addEventListener("click", event => {
    if ((event.target as Element).closest("[data-empty-clear-search]")) {
      search.value = ""; currentQuery = ""; displayLimit = 80; renderList(); search.focus(); return;
    }
    if ((event.target as Element).closest("[data-empty-reset-filters]")) { resetFilters(); return; }
    if ((event.target as Element).closest("[data-load-more]")) {
      displayLimit += 80;
      renderList();
      return;
    }
    const external = (event.target as Element).closest<HTMLElement>("[data-external-url]");
    if (external?.dataset.externalUrl) {
      event.preventDefault();
      event.stopPropagation();
      openExternalUrl(external.dataset.externalUrl);
      return;
    }
    const target = (event.target as Element).closest<HTMLElement>("[data-entry-id]");
    const entry = target && compendiumEntries.find(item => item.id === target.dataset.entryId);
    if (entry) showEntry(entry);
  });
  detail.addEventListener("click", async event => {
    const rollButton = (event.target as Element).closest<HTMLButtonElement>("[data-monster-roll-action]");
    if (rollButton?.dataset.monsterRollAction) {
      event.preventDefault();
      event.stopPropagation();
      const target = monsterRollTargets.get(rollButton.dataset.monsterRollAction);
      if (!target?.entry.monster) return;
      let attackRollMode: MonsterAttackRollMode = currentPreferences.monsterRollMode === "single" ? "single" : "two";
      if (currentPreferences.monsterRollMode === "ask" && resolveMonsterAction(target.entry.monster, target.action)?.attack) {
        const choice = await askMonsterRollMode(target.action.name, rollButton);
        if (!choice) return;
        attackRollMode = choice;
      }
      const command = buildMonsterRollCommand(target.entry, target.action, attackRollMode);
      if (!command) return;
      const chatResult = prepareRoll20Chat(command, currentPreferences.autoRollMonsterActions === true);
      const copied = chatResult === "unavailable" ? await writeClipboardText(command) : false;
      const succeeded = chatResult !== "unavailable" || copied;
      const status = detail.querySelector<HTMLElement>("[data-copy-status]");
      const label = rollButton.querySelector<HTMLElement>("[data-roll-label]");
      if (label) label.textContent = chatResult === "sent" ? "✓ Lancé" : chatResult === "prefilled" ? "Chat prêt" : copied ? "✓ Copiée" : "Échec";
      if (status) status.textContent = chatResult === "sent"
        ? "Jet envoyé dans le chat Roll20."
        : chatResult === "prefilled" ? "Chat Roll20 prérempli. La commande n’a pas été envoyée."
        : copied ? "Macro Roll20 copiée dans le presse-papiers." : "La préparation de la macro Roll20 a échoué.";
      const previousButtonTimer = copyFeedbackTimers.get(rollButton);
      if (previousButtonTimer !== undefined) window.clearTimeout(previousButtonTimer);
      copyFeedbackTimers.set(rollButton, window.setTimeout(() => {
        if (label?.isConnected) label.textContent = "Roll20";
      }, 1800));
      if (copyStatusTimer !== undefined) window.clearTimeout(copyStatusTimer);
      copyStatusTimer = window.setTimeout(() => {
        if (status?.isConnected) status.textContent = "";
      }, 1800);
      if (!succeeded) rollButton.focus();
      return;
    }
    const copyButton = (event.target as Element).closest<HTMLButtonElement>("[data-copy-target]");
    if (copyButton?.dataset.copyTarget) {
      event.preventDefault();
      event.stopPropagation();
      const value = copyTargets.get(copyButton.dataset.copyTarget);
      if (!value) return;
      const copied = await writeClipboardText(value);
      const status = detail.querySelector<HTMLElement>("[data-copy-status]");
      const label = copyButton.querySelector<HTMLElement>("[data-copy-label]");
      if (label) label.textContent = copied ? "✓ Copié" : "Copie impossible";
      if (status) status.textContent = copied ? "Contenu copié dans le presse-papiers." : "La copie dans le presse-papiers a échoué.";
      const previousButtonTimer = copyFeedbackTimers.get(copyButton);
      if (previousButtonTimer !== undefined) window.clearTimeout(previousButtonTimer);
      copyFeedbackTimers.set(copyButton, window.setTimeout(() => {
        if (label?.isConnected) label.textContent = "Copier";
      }, 1800));
      if (copyStatusTimer !== undefined) window.clearTimeout(copyStatusTimer);
      copyStatusTimer = window.setTimeout(() => {
        if (status?.isConnected) status.textContent = "";
      }, 1800);
      return;
    }
    const back = (event.target as Element).closest("[data-back]");
    if (back) { detail.hidden = true; home.hidden = false; panel.scrollTop = 0; return; }
    const target = (event.target as Element).closest<HTMLElement>("[data-entry-id]");
    const entry = target && compendiumEntries.find(item => item.id === target.dataset.entryId);
    if (entry) showEntry(entry);
  });
  panel.querySelector(".dd55-tabs")?.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-type]");
    if (!button) return;
    activeType = (button.dataset.type || undefined) as CompendiumFilter | undefined;
    if (activeType === "monster") syncMonsterAdvanced(false);
    displayLimit = 80;
    syncCategory();
    renderList();
  });
  spellClass.addEventListener("change", () => { activeSpellClass = spellClass.value; displayLimit = 80; renderList(); });
  spellLevel.addEventListener("change", () => { activeSpellLevel = spellLevel.value; displayLimit = 80; renderList(); });
  clearSpellFilters.addEventListener("click", () => { activeSpellClass = ""; activeSpellLevel = ""; spellClass.value = ""; spellLevel.value = ""; displayLimit = 80; renderList(); });
  originKind.addEventListener("change", () => { activeOriginKind = originKind.value as typeof activeOriginKind; displayLimit = 80; renderList(); });
  clearOriginFilters.addEventListener("click", () => { activeOriginKind = ""; originKind.value = ""; displayLimit = 80; renderList(); });
  equipmentType.addEventListener("change", () => { activeEquipmentType = equipmentType.value; displayLimit = 80; renderList(); });
  weaponMastery.addEventListener("change", () => { activeWeaponMastery = weaponMastery.value; displayLimit = 80; renderList(); });
  clearEquipmentFilters.addEventListener("click", () => { activeEquipmentType = ""; activeWeaponMastery = ""; equipmentType.value = ""; weaponMastery.value = ""; displayLimit = 80; renderList(); });
  ruleKind.addEventListener("change", () => { activeRuleKind = ruleKind.value; displayLimit = 80; renderList(); });
  clearRuleFilters.addEventListener("click", () => { activeRuleKind = ""; ruleKind.value = ""; displayLimit = 80; renderList(); });
  featCategory.addEventListener("change", () => { activeFeatCategory = featCategory.value; displayLimit = 80; renderList(); });
  featSource.addEventListener("change", () => { activeFeatSource = featSource.value; displayLimit = 80; renderList(); });
  clearFeatFilters.addEventListener("click", () => { activeFeatCategory = ""; activeFeatSource = ""; featCategory.value = ""; featSource.value = ""; displayLimit = 80; renderList(); });
  classKind.addEventListener("change", () => { activeClassKind = classKind.value as typeof activeClassKind; displayLimit = 80; renderList(); });
  magicItemFilters.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-magic-rarity]");
    if (!button?.dataset.magicRarity) return;
    const rarity = button.dataset.magicRarity as MagicItemRarity;
    if (activeMagicItemRarities.has(rarity)) activeMagicItemRarities.delete(rarity); else activeMagicItemRarities.add(rarity);
    const selected = activeMagicItemRarities.has(rarity);
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
    displayLimit = 80; renderList();
  });
  magicItemSort.addEventListener("change", () => { activeMagicItemSort = magicItemSort.value as MagicItemSort; displayLimit = 80; renderList(); });
  clearMagicItemFilters.addEventListener("click", () => {
    activeMagicItemRarities.clear(); activeMagicItemSort = "name"; magicItemSort.value = "name";
    magicItemFilters.querySelectorAll<HTMLButtonElement>("[data-magic-rarity]").forEach(button => { button.classList.remove("is-active"); button.setAttribute("aria-pressed", "false"); });
    displayLimit = 80; renderList();
  });
  monsterType.addEventListener("change", () => { activeMonsterType = monsterType.value; displayLimit = 80; renderList(); });
  const updateMonsterFpRange = (changed: "min" | "max") => {
    activeMonsterFpMin = monsterFpMin.value; activeMonsterFpMax = monsterFpMax.value;
    const min = activeMonsterFpMin ? monsterChallengeValues.get(activeMonsterFpMin)! : undefined;
    const max = activeMonsterFpMax ? monsterChallengeValues.get(activeMonsterFpMax)! : undefined;
    if (min !== undefined && max !== undefined && min > max) {
      if (changed === "min") activeMonsterFpMax = monsterFpMax.value = activeMonsterFpMin;
      else activeMonsterFpMin = monsterFpMin.value = activeMonsterFpMax;
    }
    displayLimit = 80; renderList();
  };
  monsterFpMin.addEventListener("change", () => updateMonsterFpRange("min"));
  monsterFpMax.addEventListener("change", () => updateMonsterFpRange("max"));
  monsterSize.addEventListener("change", () => { activeMonsterSize = monsterSize.value; displayLimit = 80; renderList(); });
  monsterCategory.addEventListener("change", () => { activeMonsterCategory = monsterCategory.value; displayLimit = 80; renderList(); });
  monsterAlignment.addEventListener("change", () => { activeMonsterAlignment = monsterAlignment.value; displayLimit = 80; renderList(); });
  monsterMovement.addEventListener("change", () => { activeMonsterMovement = monsterMovement.value; displayLimit = 80; renderList(); });
  monsterLegendary.addEventListener("change", () => { activeMonsterLegendary = monsterLegendary.value; displayLimit = 80; renderList(); });
  const bindMonsterRange = (minimum: HTMLInputElement, maximum: HTMLInputElement, setMinimum: (value: string) => void, setMaximum: (value: string) => void) => {
    minimum.addEventListener("input", () => {
      if (minimum.value && maximum.value && Number(minimum.value) > Number(maximum.value)) maximum.value = minimum.value;
      setMinimum(minimum.value); setMaximum(maximum.value); displayLimit = 80; renderList();
    });
    maximum.addEventListener("input", () => {
      if (minimum.value && maximum.value && Number(maximum.value) < Number(minimum.value)) minimum.value = maximum.value;
      setMinimum(minimum.value); setMaximum(maximum.value); displayLimit = 80; renderList();
    });
  };
  bindMonsterRange(monsterCaMin, monsterCaMax, value => { activeMonsterCaMin = value; }, value => { activeMonsterCaMax = value; });
  bindMonsterRange(monsterHpMin, monsterHpMax, value => { activeMonsterHpMin = value; }, value => { activeMonsterHpMax = value; });
  monsterAdvancedToggle.addEventListener("click", () => syncMonsterAdvanced(monsterAdvanced.hidden));
  clearMonsterFilters.addEventListener("click", () => { resetMonsterFilters(); displayLimit = 80; renderList(); });
  search.addEventListener("input", () => { currentQuery = search.value.trim(); displayLimit = 80; renderList(); });
  clearSearch.addEventListener("click", () => { search.value = ""; currentQuery = ""; displayLimit = 80; renderList(); search.focus(); });

  const setExpanded = (expanded: boolean) => {
    panel.classList.toggle("is-expanded", expanded);
    const label = expanded ? "Réduire le compendium" : "Agrandir le compendium";
    expandButton.setAttribute("aria-pressed", String(expanded));
    expandButton.setAttribute("aria-label", label);
    expandButton.title = label;
    expandButton.innerHTML = expanded
      ? `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5"/></svg>`
      : `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>`;
  };
  launcher.addEventListener("click", () => {
    if (suppressClick) { suppressClick = false; return; }
    panel.hidden = !panel.hidden;
    launcher.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) {
      syncMonsterAdvanced(false);
      if (!listRendered) renderList();
      setExpanded(Boolean(currentPreferences.expandedByDefault));
      if (!currentPreferences.expandedByDefault && currentPreferences.panelPosition) placePanel(currentPreferences.panelPosition.left, currentPreferences.panelPosition.top);
      (home.hidden ? panel.querySelector<HTMLElement>("[data-back], [data-settings-back]") : search)?.focus();
    }
  });
  expandButton.addEventListener("click", () => setExpanded(!panel.classList.contains("is-expanded")));
  settingsButton.addEventListener("click", () => {
    viewBeforeSettings = detail.hidden ? "home" : "detail";
    scrollBeforeSettings = panel.scrollTop;
    home.hidden = true; detail.hidden = true; settings.hidden = false; panel.scrollTop = 0;
    panel.querySelector<HTMLButtonElement>("[data-settings-back]")!.focus();
  });
  const closeSettings = () => {
    settings.hidden = true;
    home.hidden = viewBeforeSettings !== "home";
    detail.hidden = viewBeforeSettings !== "detail";
    panel.scrollTop = scrollBeforeSettings;
    settingsButton.focus();
  };
  panel.querySelector("[data-settings-back]")?.addEventListener("click", closeSettings);
  panel.querySelector("[data-close]")?.addEventListener("click", () => { panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); });
  panel.addEventListener("change", event => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.matches("[data-enabled], [data-bilingual]")) {
      const next = { enabled: panel.querySelector<HTMLInputElement>("[data-enabled]")!.checked, bilingual: panel.querySelector<HTMLInputElement>("[data-bilingual]")!.checked };
      currentPreferences = { ...currentPreferences, ...next };
      onChange(next);
    } else if (target.matches("[data-setting-theme]")) updatePreferences({ theme: target.value as Preferences["theme"] });
    else if (target.matches("[data-setting-font-size]")) updatePreferences({ fontSize: target.value as Preferences["fontSize"] });
    else if (target.matches("[data-setting-density]")) updatePreferences({ resultDensity: target.value as Preferences["resultDensity"] });
    else if (target.matches("[data-default-category]")) updatePreferences({ defaultCategory: target.value as Preferences["defaultCategory"] });
    else if (target.matches("[data-expanded-default]")) { const checked = (target as HTMLInputElement).checked; updatePreferences({ expandedByDefault: checked }); setExpanded(checked); }
    else if (target.matches("[data-monster-roll-mode]")) updatePreferences({ monsterRollMode: target.value as MonsterRollMode });
    else if (target.matches("[data-auto-roll-monsters]")) updatePreferences({ autoRollMonsterActions: (target as HTMLInputElement).checked });
    else if (target.matches("[data-launcher-visible]")) { const checked = (target as HTMLInputElement).checked; updatePreferences({ launcherVisible: checked }); launcher.hidden = !checked; }
  });
  panel.querySelector("[data-reset-launcher]")?.addEventListener("click", () => {
    launcher.style.removeProperty("left"); launcher.style.removeProperty("top"); launcher.style.removeProperty("right"); launcher.style.removeProperty("bottom");
    currentPreferences = { ...currentPreferences, launcherPosition: null };
    onLauncherChange?.({ launcherPosition: null });
  });
  panel.querySelector("[data-reset-panel]")?.addEventListener("click", () => {
    panel.style.removeProperty("left"); panel.style.removeProperty("top"); panel.style.removeProperty("right"); panel.style.removeProperty("bottom");
    currentPreferences = { ...currentPreferences, panelPosition: null };
    onLauncherChange?.({ panelPosition: null });
  });
  panel.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!settings.hidden) { event.preventDefault(); closeSettings(); return; }
    panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); launcher.focus();
  });
  document.addEventListener("dd55:open-entry", event => {
    const id = (event as CustomEvent<string>).detail;
    const entry = compendiumEntries.find(item => item.id === id);
    if (!entry) return;
    panel.hidden = false; launcher.setAttribute("aria-expanded", "true"); showEntry(entry);
  });
  document.addEventListener("dd55:toggle-launcher", () => {
    const visible = launcher.hidden;
    launcher.hidden = !visible;
    if (visible && launcher.style.left && launcher.style.top) placeLauncher(Number.parseFloat(launcher.style.left), Number.parseFloat(launcher.style.top));
    if (!visible) { panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); }
    onLauncherChange?.({ launcherVisible: visible });
  });
  window.addEventListener("resize", () => {
    if (launcher.style.left && launcher.style.top) placeLauncher(Number.parseFloat(launcher.style.left), Number.parseFloat(launcher.style.top));
    if (panel.style.left && panel.style.top && !panel.classList.contains("is-expanded")) placePanel(Number.parseFloat(panel.style.left), Number.parseFloat(panel.style.top));
  });
}
