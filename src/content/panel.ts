import { feats, spells } from "../data/references";
import { normalizeName, referenceUrl } from "../services/reference-matcher";
import { compendiumEntries, findCompendiumEntry, searchCompendium, type CompendiumEntry, type CompendiumTable, type CompendiumType } from "../services/srd-compendium";
import type { Preferences, Reference } from "../types";

type CompendiumFilter = CompendiumType | "classes";
type ExternalReference = { item: Reference; kind: "spell" | "feat" };
const typeLabels: Record<CompendiumType, string> = { spell: "Sort", feat: "Don", rule: "Règle", class: "Classe", subclass: "Sous-classe" };
const spellClassNames = [...new Set(compendiumEntries
  .filter(entry => entry.type === "spell")
  .flatMap(entry => (entry.meta.Classes ?? "").split(", ").filter(Boolean)))].sort((a, b) => a.localeCompare(b, "fr"));
const spellLevels = ["Mineur", ...Array.from({ length: 9 }, (_, index) => String(index + 1))];
function hasLocalEntry(item: Reference, kind: "spell" | "feat"): boolean {
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

function externalReferences(query: string, type?: CompendiumFilter): ExternalReference[] {
  if (type === "classes" || type === "class" || type === "subclass") return [];
  const normalized = normalizeName(query);
  return externalReferenceCatalog.filter(({ item, kind }) =>
    (!type || type === kind) &&
    (!normalized || normalizeName(`${item.nameFr} ${item.nameEn} ${(item.aliases ?? []).join(" ")}`).includes(normalized))
  );
}

function renderEntryCard(entry: CompendiumEntry): string {
  const summary = entry.sections[0]?.content ?? "";
  const icon = entry.type === "spell" ? "✦" : entry.type === "feat" ? "◆" : entry.type === "class" ? "♜" : entry.type === "subclass" ? "♟" : "§";
  return `<button type="button" class="dd55-entry-card" data-entry-id="${entry.id}"><span class="dd55-entry-icon" data-kind="${entry.type}">${icon}</span><span class="dd55-entry-main"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.subtitle)}</small>${summary ? `<span>${escapeHtml(summary.slice(0, 130))}${summary.length > 130 ? "…" : ""}</span>` : ""}</span><span class="dd55-chevron">›</span></button>`;
}

function renderExternalCard({ item, kind }: ExternalReference): string {
  const subtype = kind === "spell" ? item.level === 0 ? "Sort mineur" : `Sort de niveau ${item.level}` : "Don";
  return `<button type="button" class="dd55-entry-card dd55-external" data-external-url="${referenceUrl(kind, item)}"><span class="dd55-entry-icon" data-kind="external">↗</span><span class="dd55-entry-main"><strong>${escapeHtml(item.nameFr)}</strong><small>${subtype} · ${escapeHtml(item.nameEn)}</small><span>Absent du SRD · consulter sur AideDD</span></span></button>`;
}

function openExternalUrl(url: string): void {
  if (typeof globalThis.chrome !== "undefined") {
    void chrome.runtime.sendMessage({ type: "DD55_OPEN_EXTERNAL", url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderPresentation(entry: CompendiumEntry, content: string): string {
  if (entry.type !== "class") {
    return `<section class="dd55-presentation"><div class="dd55-section-kicker">Présentation</div><div class="dd55-presentation-copy"><span aria-hidden="true">✦</span><p>${escapeHtml(content)}</p></div></section>`;
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
  return `<section class="dd55-presentation"><div class="dd55-section-kicker">Présentation</div><div class="dd55-section-title"><div><h3>Commencer comme ${escapeHtml(entry.title)}</h3><p>Les éléments reçus lors de la création du personnage.</p></div></div><div class="dd55-start-grid">${cards}</div></section>`;
}

function renderCompendiumTable(table: CompendiumTable, className: string): string {
  const headers = table.headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join("");
  const rows = table.rows.map(row => `<tr class="${row[2] && row[2] !== "—" ? "has-feature" : ""}">${row.map((cell, index) => index === 0
    ? `<th scope="row">${escapeHtml(cell)}</th>`
    : `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<section class="dd55-progression"><div class="dd55-section-kicker">Progression</div><div class="dd55-progression-heading"><div><h3>Progression du ${escapeHtml(className)}</h3><p>Aptitudes et ressources acquises du niveau 1 au niveau 20.</p></div><span>${table.rows.length}<small>niveaux</small></span></div><div class="dd55-table-hint"><span>↔ Faites défiler le tableau horizontalement</span><span><abbr title="Bonus de maîtrise">BM</abbr> : bonus de maîtrise · <abbr title="Emplacement">Empl.</abbr> : emplacement</span></div><div class="dd55-table-scroll" tabindex="0" aria-label="${escapeHtml(table.title)}"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function mountPanel(preferences: Preferences, onChange: (next: Preferences) => void): void {
  if (document.querySelector("#dd55-companion")) return;
  let activeType: CompendiumFilter | undefined;
  let currentQuery = "";
  let activeSpellClass = "";
  let activeSpellLevel = "";

  const launcher = document.createElement("button");
  launcher.id = "dd55-launcher"; launcher.type = "button"; launcher.textContent = "📖 D&D 5.5 FR"; launcher.setAttribute("aria-expanded", "false");
  const panel = document.createElement("aside"); panel.id = "dd55-companion"; panel.hidden = true;
  panel.innerHTML = `<header><div><strong>Compendium D&D 5.5 FR</strong><small>SRD 5.2.1 · hors ligne</small></div><button type="button" data-close aria-label="Fermer">×</button></header><div data-home><details class="dd55-settings"><summary>Réglages de la feuille</summary><label><input type="checkbox" data-enabled ${preferences.enabled ? "checked" : ""}> Traduire la feuille</label><label><input type="checkbox" data-bilingual ${preferences.bilingual ? "checked" : ""}> Conserver les noms anglais</label></details><div class="dd55-search-wrap"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg><input data-search type="search" placeholder="Rechercher une règle, une classe, un sort…" aria-label="Recherche dans le compendium"></div><nav class="dd55-tabs" aria-label="Catégories"><button type="button" data-type="" class="is-active">Tout <small>${totalReferenceCount}</small></button><button type="button" data-type="rule">Règles <small>${compendiumEntries.filter(e => e.type === "rule").length}</small></button><button type="button" data-type="classes">Classes <small>${compendiumEntries.filter(e => e.type === "class" || e.type === "subclass").length}</small></button><button type="button" data-type="spell">Sorts <small>${spellReferenceCount}</small></button><button type="button" data-type="feat">Dons <small>${featReferenceCount}</small></button></nav><div class="dd55-spell-filters" data-spell-filters hidden><div><span>Filtrer les sorts</span><button type="button" data-clear-spell-filters hidden>Effacer</button></div><div class="dd55-filter-fields"><label><span>Classe</span><select data-spell-class><option value="">Toutes les classes</option>${spellClassNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label><label><span>Niveau</span><select data-spell-level><option value="">Tous les niveaux</option>${spellLevels.map(level => `<option value="${level}">${level === "Mineur" ? "Sort mineur" : `Niveau ${level}`}</option>`).join("")}</select></label></div></div><div class="dd55-result-heading"><strong data-result-title>Tout le compendium</strong><span data-result-count></span></div><div data-results class="dd55-entry-list"></div></div><article data-detail hidden></article><footer>Contenu local issu du SRD 5.2.1 FR · CC BY 4.0.<details><summary>Attribution et licence</summary>Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible sur <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">D&D Beyond</a>, sous <a href="https://creativecommons.org/licenses/by/4.0/legalcode.fr" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</details></footer>`;
  document.body.append(launcher, panel);

  const home = panel.querySelector<HTMLElement>("[data-home]")!;
  const results = panel.querySelector<HTMLElement>("[data-results]")!;
  const detail = panel.querySelector<HTMLElement>("[data-detail]")!;
  const search = panel.querySelector<HTMLInputElement>("[data-search]")!;
  const spellFilters = panel.querySelector<HTMLElement>("[data-spell-filters]")!;
  const spellClass = panel.querySelector<HTMLSelectElement>("[data-spell-class]")!;
  const spellLevel = panel.querySelector<HTMLSelectElement>("[data-spell-level]")!;
  const clearSpellFilters = panel.querySelector<HTMLButtonElement>("[data-clear-spell-filters]")!;

  const renderList = () => {
    let matchingEntries = activeType === "classes"
      ? [...searchCompendium(currentQuery, "class", 1000), ...searchCompendium(currentQuery, "subclass", 1000)].sort((a, b) => a.title.localeCompare(b.title, "fr"))
      : searchCompendium(currentQuery, activeType, 1000);
    if (activeType === "spell") matchingEntries = matchingEntries.filter(entry =>
      (!activeSpellClass || entry.tags.includes(activeSpellClass)) &&
      (!activeSpellLevel || entry.meta.Niveau === activeSpellLevel)
    );
    const entries = activeType === "spell" || activeType === "feat" ? matchingEntries : matchingEntries.slice(0, 80);
    let externalMatches = activeType === "spell" && activeSpellClass ? [] : externalReferences(currentQuery, activeType);
    if (activeType === "spell" && activeSpellLevel) {
      const wantedLevel = activeSpellLevel === "Mineur" ? 0 : Number(activeSpellLevel);
      externalMatches = externalMatches.filter(({ item }) => item.level === wantedLevel);
    }
    const external = activeType === "spell" || activeType === "feat" ? externalMatches : externalMatches.slice(0, currentQuery ? 20 : 8);
    const resultCount = matchingEntries.length + externalMatches.length;
    panel.querySelector<HTMLElement>("[data-result-title]")!.textContent = currentQuery ? `Résultats pour « ${currentQuery} »` : activeType === "classes" ? "Classes et sous-classes" : activeType === "feat" ? "Dons du compendium" : activeType === "spell" ? "Sorts du compendium" : activeType ? `${typeLabels[activeType]}s du SRD` : "Tout le compendium";
    panel.querySelector<HTMLElement>("[data-result-count]")!.textContent = `${resultCount} référence${resultCount > 1 ? "s" : ""}`;
    clearSpellFilters.hidden = !(activeSpellClass || activeSpellLevel);
    const cards = [
      ...entries.map(entry => ({ title: entry.title, html: renderEntryCard(entry) })),
      ...external.map(reference => ({ title: reference.item.nameFr, html: renderExternalCard(reference) }))
    ];
    if (activeType === "feat" || activeType === "spell") cards.sort((a, b) => a.title.localeCompare(b.title, "fr"));
    results.innerHTML = cards.map(card => card.html).join("") || `<p class="dd55-empty">Aucune fiche trouvée.</p>`;
  };

  const showEntry = (entry: CompendiumEntry) => {
    home.hidden = true; detail.hidden = false;
    const metadata = Object.entries(entry.meta).filter(([, value]) => value).map(([label, value]) => `<div class="${value.length > 85 ? "is-wide" : ""}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    const presentation = entry.sections[0]?.heading === "Présentation" ? renderPresentation(entry, entry.sections[0].content) : "";
    const articleSections = presentation ? entry.sections.slice(1) : entry.sections;
    const tables = entry.tables?.map(table => renderCompendiumTable(table, entry.title)).join("") ?? "";
    const sections = articleSections.map(section => `<section>${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : ""}<p>${escapeHtml(section.content)}</p></section>`).join("");
    const related = compendiumEntries.filter(candidate => candidate.id !== entry.id && candidate.type === entry.type && candidate.tags.some(tag => entry.tags.includes(tag))).slice(0, 6);
    detail.innerHTML = `<div class="dd55-detail-toolbar"><button type="button" data-back>← Compendium</button><span>Page SRD ${entry.page}</span></div><div class="dd55-detail-hero" data-kind="${entry.type}"><span>${typeLabels[entry.type]}</span><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.subtitle)}</p></div>${metadata ? `<dl class="dd55-meta-grid">${metadata}</dl>` : ""}${presentation}${tables}<div class="dd55-article">${sections}</div>${related.length ? `<aside class="dd55-related"><h3>À découvrir aussi</h3>${related.map(item => `<button type="button" data-entry-id="${item.id}">${escapeHtml(item.title)}<span>›</span></button>`).join("")}</aside>` : ""}<p class="dd55-source">Source : SRD 5.2.1 FR, page ${entry.page} · CC BY 4.0</p>`;
    panel.scrollTop = 0;
  };

  renderList();
  results.addEventListener("click", event => {
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
  detail.addEventListener("click", event => {
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
    spellFilters.hidden = activeType !== "spell";
    panel.querySelectorAll(".dd55-tabs button").forEach(item => item.classList.toggle("is-active", item === button));
    renderList();
  });
  spellClass.addEventListener("change", () => { activeSpellClass = spellClass.value; renderList(); });
  spellLevel.addEventListener("change", () => { activeSpellLevel = spellLevel.value; renderList(); });
  clearSpellFilters.addEventListener("click", () => { activeSpellClass = ""; activeSpellLevel = ""; spellClass.value = ""; spellLevel.value = ""; renderList(); });
  search.addEventListener("input", () => { currentQuery = search.value.trim(); renderList(); });
  launcher.addEventListener("click", () => { panel.hidden = !panel.hidden; launcher.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) search.focus(); });
  panel.querySelector("[data-close]")?.addEventListener("click", () => { panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); });
  panel.addEventListener("change", event => {
    if (!(event.target as Element).matches("[data-enabled], [data-bilingual]")) return;
    onChange({ enabled: panel.querySelector<HTMLInputElement>("[data-enabled]")!.checked, bilingual: panel.querySelector<HTMLInputElement>("[data-bilingual]")!.checked });
  });
  document.addEventListener("dd55:open-entry", event => {
    const id = (event as CustomEvent<string>).detail;
    const entry = compendiumEntries.find(item => item.id === id);
    if (!entry) return;
    panel.hidden = false; launcher.setAttribute("aria-expanded", "true"); showEntry(entry);
  });
}
