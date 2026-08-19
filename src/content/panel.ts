import { feats, spells } from "../data/references";
import { normalizeName, referenceUrl } from "../services/reference-matcher";
import { compendiumEntries, findCompendiumEntry, searchCompendiumResults, type CompendiumEntry, type CompendiumSearchResult, type CompendiumTable, type CompendiumType } from "../services/srd-compendium";
import type { Preferences, Reference } from "../types";

type CompendiumFilter = CompendiumType | "classes" | "origins";
type ExternalReference = { item: Reference; kind: "spell" | "feat" };
type ExternalSearchResult = ExternalReference & { score: number };
const typeLabels: Record<CompendiumType, string> = { spell: "Sort", feat: "Don", rule: "Règle", class: "Classe", subclass: "Sous-classe", equipment: "Équipement", species: "Espèce", background: "Historique" };
const spellClassNames = [...new Set(compendiumEntries
  .filter(entry => entry.type === "spell")
  .flatMap(entry => (entry.meta.Classes ?? "").split(", ").filter(Boolean)))].sort((a, b) => a.localeCompare(b, "fr"));
const spellLevels = ["Mineur", ...Array.from({ length: 9 }, (_, index) => String(index + 1))];
const equipmentTypes = [...new Set(compendiumEntries.filter(entry => entry.type === "equipment").map(entry => entry.meta["Type d’équipement"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const weaponMasteries = [...new Set(compendiumEntries.filter(entry => entry.type === "equipment").map(entry => entry.meta["Botte d’arme"]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
const ruleKinds = [...new Set(compendiumEntries.filter(entry => entry.type === "rule").map(entry => entry.meta.Catégorie || entry.subtitle).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
function hasLocalEntry(item: Reference, kind: "spell" | "feat"): boolean {
  if (item.compendiumId) return true;
  return [item.nameFr, item.nameEn, ...(item.aliases ?? [])].some(name => findCompendiumEntry(name, kind));
}
const externalReferenceCatalog: ExternalReference[] = [
  ...spells.map(item => ({ item, kind: "spell" as const })),
  ...feats.map(item => ({ item, kind: "feat" as const }))
].filter(({ item, kind }) => !hasLocalEntry(item, kind));
const localFeatCount = compendiumEntries.filter(entry => entry.type === "feat").length;
const featReferenceCount = localFeatCount + externalReferenceCatalog.filter(reference => reference.kind === "feat").length;
const localSpellCount = compendiumEntries.filter(entry => entry.type === "spell").length;
const spellReferenceCount = localSpellCount + externalReferenceCatalog.filter(reference => reference.kind === "spell").length;
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
  return externalReferenceCatalog.flatMap(reference => {
    if (type && type !== reference.kind) return [];
    const title = normalizeName(reference.item.nameFr);
    const tokens = searchTokens(`${reference.item.nameFr} ${reference.item.nameEn} ${(reference.item.aliases ?? []).join(" ")}`);
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
  const summary = result.excerpt || entry.sections[0]?.content || "";
  const icon = entry.type === "spell" ? "✦" : entry.type === "feat" ? "◆" : entry.type === "class" ? "♜" : entry.type === "subclass" ? "♟" : entry.type === "equipment" ? "⚔" : entry.type === "species" ? "♧" : entry.type === "background" ? "⌂" : "§";
  return `<button type="button" class="dd55-entry-card" data-entry-id="${entry.id}"><span class="dd55-entry-icon" data-kind="${entry.type}">${icon}</span><span class="dd55-entry-main"><strong>${highlightText(entry.title, query)}</strong><small>${highlightText(entry.subtitle, query)}</small>${summary ? `<span>${highlightText(summary.slice(0, 170), query)}${summary.length > 170 ? "…" : ""}</span>` : ""}</span><span class="dd55-chevron">›</span></button>`;
}

function renderExternalCard({ item, kind }: ExternalReference, query: string): string {
  const subtype = kind === "spell" ? item.level === 0 ? "Sort mineur" : `Sort de niveau ${item.level}` : "Don";
  return `<button type="button" class="dd55-entry-card dd55-external" data-external-url="${referenceUrl(kind, item)}"><span class="dd55-entry-icon" data-kind="external">↗</span><span class="dd55-entry-main"><strong>${highlightText(item.nameFr, query)}</strong><small>${highlightText(`${subtype} · ${item.nameEn}`, query)}</small><span>Absent du SRD · consulter sur AideDD</span></span></button>`;
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

function serializeTable(table: CompendiumTable): string {
  return [table.title, table.headers.join("\t"), ...table.rows.map(row => row.join("\t"))].join("\n");
}

function serializeEntry(entry: CompendiumEntry): string {
  const metadata = Object.entries(entry.meta).filter(([, value]) => value).map(([label, value]) => `${label} : ${value}`);
  const presentation = entry.sections[0]?.heading === "Présentation" ? entry.sections[0] : undefined;
  const articleSections = presentation ? entry.sections.slice(1) : entry.sections;
  const blocks = [
    entry.title,
    entry.subtitle,
    metadata.join("\n"),
    presentation ? serializeSection(presentation.heading, presentation.content) : "",
    ...(entry.tables ?? []).map(serializeTable),
    ...articleSections.map(section => serializeSection(section.heading, section.content)),
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

export function mountPanel(preferences: Preferences, onChange: (next: Partial<Preferences>) => void, onLauncherChange?: (next: Partial<Preferences>) => void): void {
  if (document.querySelector("#dd55-companion")) return;
  let currentPreferences: Preferences = {
    theme: "light", fontSize: "normal", resultDensity: "comfortable", defaultCategory: "",
    expandedByDefault: false, launcherVisible: true, ...preferences
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
  let displayLimit = 80;
  let listRendered = false;
  let viewBeforeSettings: "home" | "detail" = "home";
  let scrollBeforeSettings = 0;
  let copyTargets = new Map<string, string>();
  const copyFeedbackTimers = new WeakMap<HTMLElement, number>();
  let copyStatusTimer: number | undefined;

  const launcher = document.createElement("button");
  launcher.id = "dd55-launcher"; launcher.type = "button"; launcher.textContent = "📖 D&D 5.5 FR"; launcher.setAttribute("aria-expanded", "false");
  launcher.title = "Ouvrir le compendium · déplacer par glisser-déposer";
  launcher.hidden = currentPreferences.launcherVisible === false;
  const panel = document.createElement("aside"); panel.id = "dd55-companion"; panel.hidden = true;
  panel.innerHTML = `<header><div><strong>Compendium D&D 5.5 FR</strong><small>SRD 5.2.1 · hors ligne</small></div><button type="button" data-close aria-label="Fermer">×</button></header><div data-home><div class="dd55-search-wrap"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg><input data-search type="search" placeholder="Rechercher une règle, une origine, un sort, une arme…" aria-label="Recherche dans le compendium"><button type="button" data-clear-search aria-label="Effacer la recherche" hidden>×</button></div><nav class="dd55-tabs" aria-label="Catégories"><button type="button" data-type="">Tout <small>${totalReferenceCount}</small></button><button type="button" data-type="rule">Règles <small>${compendiumEntries.filter(e => e.type === "rule").length}</small></button><button type="button" data-type="classes">Classes <small>${compendiumEntries.filter(e => e.type === "class" || e.type === "subclass").length}</small></button><button type="button" data-type="origins">Origines <small>${compendiumEntries.filter(e => e.type === "species" || e.type === "background").length}</small></button><button type="button" data-type="equipment">Équipement <small>${compendiumEntries.filter(e => e.type === "equipment").length}</small></button><button type="button" data-type="spell">Sorts <small>${spellReferenceCount}</small></button><button type="button" data-type="feat">Dons <small>${featReferenceCount}</small></button></nav><div class="dd55-spell-filters" data-rule-filters hidden><div><span>Filtrer les règles</span><button type="button" data-clear-rule-filters hidden>Effacer</button></div><div class="dd55-filter-fields dd55-filter-single"><label><span>Type de règle</span><select data-rule-kind><option value="">Tous les types</option>${ruleKinds.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label></div></div><div class="dd55-spell-filters" data-class-filters hidden><div><span>Filtrer les classes</span></div><div class="dd55-filter-fields dd55-filter-single"><label><span>Type de fiche</span><select data-class-kind><option value="class" selected>Classes seulement</option><option value="subclass">Sous-classes seulement</option><option value="">Classes et sous-classes</option></select></label></div></div><div class="dd55-spell-filters" data-spell-filters hidden><div><span>Filtrer les sorts</span><button type="button" data-clear-spell-filters hidden>Effacer</button></div><div class="dd55-filter-fields"><label><span>Classe</span><select data-spell-class><option value="">Toutes les classes</option>${spellClassNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label><label><span>Niveau</span><select data-spell-level><option value="">Tous les niveaux</option>${spellLevels.map(level => `<option value="${level}">${level === "Mineur" ? "Sort mineur" : `Niveau ${level}`}</option>`).join("")}</select></label></div></div><div class="dd55-spell-filters" data-origin-filters hidden><div><span>Filtrer les origines</span><button type="button" data-clear-origin-filters hidden>Effacer</button></div><div class="dd55-filter-fields dd55-filter-single"><label><span>Type d’origine</span><select data-origin-kind><option value="">Espèces et historiques</option><option value="species">Espèces seulement</option><option value="background">Historiques seulement</option></select></label></div></div><div class="dd55-spell-filters" data-equipment-filters hidden><div><span>Filtrer l’équipement</span><button type="button" data-clear-equipment-filters hidden>Effacer</button></div><div class="dd55-filter-fields"><label><span>Type</span><select data-equipment-type><option value="">Tous les types</option>${equipmentTypes.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label><label><span>Maîtrise d’arme</span><select data-weapon-mastery><option value="">Toutes les bottes</option>${weaponMasteries.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label></div></div><div class="dd55-result-heading"><strong data-result-title>Tout le compendium</strong><span data-result-count role="status" aria-live="polite"></span></div><div data-results class="dd55-entry-list"></div></div><section data-settings class="dd55-settings-page" hidden><div class="dd55-settings-toolbar"><button type="button" data-settings-back>← Retour</button><h2>Réglages</h2></div><div class="dd55-settings-content"><fieldset><legend>Traduction</legend><label class="dd55-switch"><span><strong>Traduire la feuille</strong><small>Traduit et enrichit la feuille D&D 2024.</small></span><input type="checkbox" data-enabled ${currentPreferences.enabled ? "checked" : ""}></label><label class="dd55-switch"><span><strong>Conserver les noms anglais</strong><small>Affiche le nom original avec sa traduction.</small></span><input type="checkbox" data-bilingual ${currentPreferences.bilingual ? "checked" : ""}></label></fieldset><fieldset><legend>Affichage</legend><label>Thème<select data-setting-theme><option value="light">Clair</option><option value="dark">Sombre</option></select></label><label>Taille du texte<select data-setting-font-size><option value="small">Petite</option><option value="normal">Normale</option><option value="large">Grande</option></select></label><label>Densité des résultats<select data-setting-density><option value="comfortable">Confortable</option><option value="compact">Compacte</option></select></label></fieldset><fieldset><legend>Comportement</legend><label>Catégorie au démarrage<select data-default-category><option value="">Tout</option><option value="rule">Règles</option><option value="classes">Classes</option><option value="origins">Origines</option><option value="equipment">Équipement</option><option value="spell">Sorts</option><option value="feat">Dons</option></select></label><label class="dd55-switch"><span><strong>Ouvrir en grand</strong><small>Agrandit automatiquement le compendium à son ouverture.</small></span><input type="checkbox" data-expanded-default ${currentPreferences.expandedByDefault ? "checked" : ""}></label><label class="dd55-switch"><span><strong>Afficher le lanceur</strong><small>S’il est masqué, utilisez l’icône de l’extension pour le réafficher.</small></span><input type="checkbox" data-launcher-visible ${currentPreferences.launcherVisible !== false ? "checked" : ""}></label></fieldset><fieldset><legend>Positions</legend><p>Vous pouvez déplacer le panneau par son en-tête et le lanceur par glisser-déposer.</p><button type="button" data-reset-panel>Rétablir la position du compendium</button><button type="button" data-reset-launcher>Rétablir la position du lanceur</button></fieldset></div></section><article data-detail hidden></article><footer>Contenu local issu du SRD 5.2.1 FR · CC BY 4.0.<details><summary>Attribution et licence</summary>Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible sur <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">D&D Beyond</a>, sous <a href="https://creativecommons.org/licenses/by/4.0/legalcode.fr" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</details></footer>`;
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
  const classFilters = panel.querySelector<HTMLElement>("[data-class-filters]")!;
  const classKind = panel.querySelector<HTMLSelectElement>("[data-class-kind]")!;

  panel.querySelector<HTMLSelectElement>("[data-setting-theme]")!.value = currentPreferences.theme ?? "light";
  panel.querySelector<HTMLSelectElement>("[data-setting-font-size]")!.value = currentPreferences.fontSize ?? "normal";
  panel.querySelector<HTMLSelectElement>("[data-setting-density]")!.value = currentPreferences.resultDensity ?? "comfortable";
  panel.querySelector<HTMLSelectElement>("[data-default-category]")!.value = currentPreferences.defaultCategory ?? "";

  const syncCategory = () => {
    spellFilters.hidden = activeType !== "spell";
    ruleFilters.hidden = activeType !== "rule";
    classFilters.hidden = activeType !== "classes";
    originFilters.hidden = activeType !== "origins";
    equipmentFilters.hidden = activeType !== "equipment";
    panel.querySelectorAll<HTMLButtonElement>(".dd55-tabs button").forEach(button => {
      const selected = (button.dataset.type || undefined) === activeType;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  };
  syncCategory();

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
    let externalMatches = activeType === "spell" && activeSpellClass ? [] : externalReferences(currentQuery, activeType);
    if (activeType === "spell" && activeSpellLevel) {
      const wantedLevel = activeSpellLevel === "Mineur" ? 0 : Number(activeSpellLevel);
      externalMatches = externalMatches.filter(({ item }) => item.level === wantedLevel);
    }
    const resultCount = matchingResults.length + externalMatches.length;
    panel.querySelector<HTMLElement>("[data-result-title]")!.textContent = currentQuery ? `Résultats pour « ${currentQuery} »` : activeType === "classes" ? activeClassKind === "class" ? "Classes du SRD" : activeClassKind === "subclass" ? "Sous-classes du SRD" : "Classes et sous-classes" : activeType === "origins" ? "Espèces et historiques" : activeType === "feat" ? "Dons du compendium" : activeType === "spell" ? "Sorts du compendium" : activeType === "equipment" ? "Équipement du SRD" : activeType ? `${typeLabels[activeType]}s du SRD` : "Tout le compendium";
    panel.querySelector<HTMLElement>("[data-result-count]")!.textContent = `${resultCount} référence${resultCount > 1 ? "s" : ""}`;
    clearSpellFilters.hidden = !(activeSpellClass || activeSpellLevel);
    clearOriginFilters.hidden = !activeOriginKind;
    clearEquipmentFilters.hidden = !(activeEquipmentType || activeWeaponMastery);
    clearRuleFilters.hidden = !activeRuleKind;
    clearSearch.hidden = !currentQuery;
    let cards = [
      ...matchingResults.map(result => ({ title: result.entry.title, score: result.score, local: true, html: renderEntryCard(result, currentQuery) })),
      ...externalMatches.map(reference => ({ title: reference.item.nameFr, score: reference.score, local: false, html: renderExternalCard(reference, currentQuery) }))
    ];
    if (currentQuery) cards.sort((a, b) => b.score - a.score || Number(b.local) - Number(a.local) || a.title.localeCompare(b.title, "fr"));
    else if (activeType === "feat" || activeType === "spell") cards.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    const maximum = displayLimit;
    const remaining = Math.max(0, cards.length - maximum);
    cards = cards.slice(0, maximum);
    const hasFilters = Boolean(activeSpellClass || activeSpellLevel || activeEquipmentType || activeWeaponMastery || activeOriginKind || activeRuleKind || (activeType === "classes" && activeClassKind !== ""));
    results.innerHTML = cards.map(card => card.html).join("") || `<div class="dd55-empty"><strong>Aucune fiche trouvée</strong><p>${currentQuery ? `Aucun résultat pour « ${escapeHtml(currentQuery)} »${hasFilters ? " avec les filtres actifs" : ""}.` : "Aucune référence ne correspond aux filtres actifs."}</p><div>${currentQuery ? `<button type="button" data-empty-clear-search>Effacer la recherche</button>` : ""}${hasFilters ? `<button type="button" data-empty-reset-filters>Réinitialiser les filtres</button>` : ""}</div></div>`;
    if (remaining) results.insertAdjacentHTML("beforeend", `<button type="button" class="dd55-load-more" data-load-more>Afficher ${Math.min(80, remaining)} références de plus <small>${remaining} restantes</small></button>`);
  };

  const showEntry = (entry: CompendiumEntry) => {
    home.hidden = true; settings.hidden = true; detail.hidden = false;
    const metadata = Object.entries(entry.meta).filter(([, value]) => value).map(([label, value]) => `<div class="${value.length > 85 ? "is-wide" : ""}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    const mastery = entry.type === "equipment" && entry.meta["Botte d’arme"] ? compendiumEntries.find(candidate => candidate.id === `rule-botte-${normalizeName(entry.meta["Botte d’arme"]).replace(/\s+/g, "-")}`) : undefined;
    const subclass = entry.type === "class" ? compendiumEntries.find(candidate => candidate.type === "subclass" && candidate.meta["Classe parente"] === entry.title) : undefined;
    const directLinks = [
      ...(entry.links ?? []).map(link => ({ ...link, entry: compendiumEntries.find(candidate => candidate.id === link.entryId) })),
      ...(mastery ? [{ label: "Botte d’arme", entryId: mastery.id, title: mastery.title, entry: mastery }] : []),
      ...(subclass ? [{ label: "Sous-classe du SRD", entryId: subclass.id, title: subclass.title, entry: subclass }] : [])
    ].filter(link => link.entry);
    const entryLinks = directLinks.map(link => `<aside class="dd55-mastery-link"><span>${escapeHtml(link.label)}</span><button type="button" data-entry-id="${link.entryId}"><strong>${escapeHtml(link.title)}</strong><small>Ouvrir la fiche complète</small><b>›</b></button></aside>`).join("");
    copyTargets = new Map<string, string>();
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
      copyTargets.set(target, serializeSection(section.heading, section.content));
      return `<section class="dd55-copyable-section"><div class="dd55-article-heading">${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : "<span></span>"}${renderCopyButton(target, `Copier ${section.heading ? `la section ${section.heading}` : "ce bloc"}`)}</div>${renderSectionContent(entry, section.content)}</section>`;
    }).join("");
    const related = compendiumEntries.filter(candidate => candidate.id !== entry.id && candidate.type === entry.type && candidate.tags.some(tag => entry.tags.includes(tag))).slice(0, 6);
    detail.innerHTML = `<div class="dd55-detail-toolbar"><button type="button" data-back>← Compendium</button><div><span>Page SRD ${entry.page}</span>${renderCopyButton("all", "Copier toute la fiche")}</div></div><p class="dd55-copy-status" data-copy-status role="status" aria-live="polite"></p><div class="dd55-detail-hero" data-kind="${entry.type}"><span>${typeLabels[entry.type]}</span><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.subtitle)}</p></div>${metadata ? `<dl class="dd55-meta-grid">${metadata}</dl>` : ""}${entryLinks}${presentation}${tables}<div class="dd55-article">${sections}</div>${related.length ? `<aside class="dd55-related"><h3>À découvrir aussi</h3>${related.map(item => `<button type="button" data-entry-id="${item.id}">${escapeHtml(item.title)}<span>›</span></button>`).join("")}</aside>` : ""}<p class="dd55-source">Source : SRD 5.2.1 FR, page ${entry.page} · CC BY 4.0</p>`;
    panel.scrollTop = 0;
  };

  const resetFilters = () => {
    activeSpellClass = ""; activeSpellLevel = ""; spellClass.value = ""; spellLevel.value = "";
    activeOriginKind = ""; originKind.value = "";
    activeEquipmentType = ""; activeWeaponMastery = ""; equipmentType.value = ""; weaponMastery.value = "";
    activeRuleKind = ""; ruleKind.value = "";
    activeClassKind = ""; classKind.value = "";
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
  classKind.addEventListener("change", () => { activeClassKind = classKind.value as typeof activeClassKind; displayLimit = 80; renderList(); });
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
