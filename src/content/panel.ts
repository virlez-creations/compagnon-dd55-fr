import { feats, spells } from "../data/references";
import { normalizeName, referenceUrl } from "../services/reference-matcher";
import { compendiumEntries, findCompendiumEntry, searchCompendium, type CompendiumEntry, type CompendiumType } from "../services/srd-compendium";
import type { Preferences, Reference } from "../types";

const typeLabels: Record<CompendiumType, string> = { spell: "Sort", feat: "Don", rule: "Règle" };

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function externalReferences(query: string, type?: CompendiumType): Array<{ item: Reference; kind: "spell" | "feat" }> {
  const normalized = normalizeName(query);
  const groups: Array<{ item: Reference; kind: "spell" | "feat" }> = [
    ...spells.map(item => ({ item, kind: "spell" as const })),
    ...feats.map(item => ({ item, kind: "feat" as const }))
  ];
  return groups.filter(({ item, kind }) =>
    (!type || type === kind) &&
    !findCompendiumEntry(item.nameFr, kind) &&
    (!normalized || normalizeName(`${item.nameFr} ${item.nameEn}`).includes(normalized))
  ).slice(0, normalized ? 20 : 8);
}

function renderEntryCard(entry: CompendiumEntry): string {
  const summary = entry.sections[0]?.content ?? "";
  return `<button type="button" class="dd55-entry-card" data-entry-id="${entry.id}"><span class="dd55-entry-icon" data-kind="${entry.type}">${entry.type === "spell" ? "✦" : entry.type === "feat" ? "◆" : "§"}</span><span class="dd55-entry-main"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.subtitle)}</small>${summary ? `<span>${escapeHtml(summary.slice(0, 130))}${summary.length > 130 ? "…" : ""}</span>` : ""}</span><span class="dd55-chevron">›</span></button>`;
}

export function mountPanel(preferences: Preferences, onChange: (next: Preferences) => void): void {
  if (document.querySelector("#dd55-companion")) return;
  let activeType: CompendiumType | undefined;
  let currentQuery = "";

  const launcher = document.createElement("button");
  launcher.id = "dd55-launcher"; launcher.type = "button"; launcher.textContent = "📖 D&D 5.5 FR"; launcher.setAttribute("aria-expanded", "false");
  const panel = document.createElement("aside"); panel.id = "dd55-companion"; panel.hidden = true;
  panel.innerHTML = `<header><div><strong>Compendium D&D 5.5 FR</strong><small>SRD 5.2.1 · hors ligne</small></div><button type="button" data-close aria-label="Fermer">×</button></header><div data-home><details class="dd55-settings"><summary>Réglages de la feuille</summary><label><input type="checkbox" data-enabled ${preferences.enabled ? "checked" : ""}> Traduire la feuille</label><label><input type="checkbox" data-bilingual ${preferences.bilingual ? "checked" : ""}> Conserver les noms anglais</label></details><div class="dd55-search-wrap"><span>⌕</span><input data-search type="search" placeholder="Rechercher une règle, un sort, un don…" aria-label="Recherche dans le compendium"></div><nav class="dd55-tabs" aria-label="Catégories"><button type="button" data-type="" class="is-active">Tout <small>${compendiumEntries.length}</small></button><button type="button" data-type="rule">Règles <small>${compendiumEntries.filter(e => e.type === "rule").length}</small></button><button type="button" data-type="spell">Sorts <small>${compendiumEntries.filter(e => e.type === "spell").length}</small></button><button type="button" data-type="feat">Dons <small>${compendiumEntries.filter(e => e.type === "feat").length}</small></button></nav><div class="dd55-result-heading"><strong data-result-title>Tout le compendium</strong><span data-result-count></span></div><div data-results class="dd55-entry-list"></div></div><article data-detail hidden></article><footer>Contenu local issu du SRD 5.2.1 FR · CC BY 4.0.<details><summary>Attribution et licence</summary>Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible sur <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">D&D Beyond</a>, sous <a href="https://creativecommons.org/licenses/by/4.0/legalcode.fr" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>.</details></footer>`;
  document.body.append(launcher, panel);

  const home = panel.querySelector<HTMLElement>("[data-home]")!;
  const results = panel.querySelector<HTMLElement>("[data-results]")!;
  const detail = panel.querySelector<HTMLElement>("[data-detail]")!;
  const search = panel.querySelector<HTMLInputElement>("[data-search]")!;

  const renderList = () => {
    const entries = searchCompendium(currentQuery, activeType, 80);
    const external = externalReferences(currentQuery, activeType);
    panel.querySelector<HTMLElement>("[data-result-title]")!.textContent = currentQuery ? `Résultats pour « ${currentQuery} »` : activeType ? `${typeLabels[activeType]}s du SRD` : "Tout le compendium";
    panel.querySelector<HTMLElement>("[data-result-count]")!.textContent = `${entries.length}${entries.length === 80 ? "+" : ""} fiche${entries.length > 1 ? "s" : ""}`;
    const localCards = entries.map(renderEntryCard).join("");
    const links = external.map(({ item, kind }) => `<a class="dd55-entry-card dd55-external" href="${referenceUrl(kind, item)}" target="_blank" rel="noopener noreferrer"><span class="dd55-entry-icon" data-kind="external">↗</span><span class="dd55-entry-main"><strong>${escapeHtml(item.nameFr)}</strong><small>${kind === "spell" ? "Sort" : "Don"} · ${escapeHtml(item.nameEn)}</small><span>Absent du SRD · consulter sur AideDD</span></span></a>`).join("");
    results.innerHTML = localCards + links || `<p class="dd55-empty">Aucune fiche trouvée.</p>`;
  };

  const showEntry = (entry: CompendiumEntry) => {
    home.hidden = true; detail.hidden = false;
    const metadata = Object.entries(entry.meta).filter(([, value]) => value).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    const sections = entry.sections.map(section => `<section>${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : ""}<p>${escapeHtml(section.content)}</p></section>`).join("");
    const related = compendiumEntries.filter(candidate => candidate.id !== entry.id && candidate.type === entry.type && candidate.tags.some(tag => entry.tags.includes(tag))).slice(0, 6);
    detail.innerHTML = `<div class="dd55-detail-toolbar"><button type="button" data-back>← Compendium</button><span>Page SRD ${entry.page}</span></div><div class="dd55-detail-hero" data-kind="${entry.type}"><span>${typeLabels[entry.type]}</span><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.subtitle)}</p></div>${metadata ? `<dl class="dd55-meta-grid">${metadata}</dl>` : ""}<div class="dd55-article">${sections}</div>${related.length ? `<aside class="dd55-related"><h3>À découvrir aussi</h3>${related.map(item => `<button type="button" data-entry-id="${item.id}">${escapeHtml(item.title)}<span>›</span></button>`).join("")}</aside>` : ""}<p class="dd55-source">Source : SRD 5.2.1 FR, page ${entry.page} · CC BY 4.0</p>`;
    panel.scrollTop = 0;
  };

  renderList();
  results.addEventListener("click", event => {
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
    activeType = (button.dataset.type || undefined) as CompendiumType | undefined;
    panel.querySelectorAll(".dd55-tabs button").forEach(item => item.classList.toggle("is-active", item === button));
    renderList();
  });
  search.addEventListener("input", () => { currentQuery = search.value.trim(); renderList(); });
  launcher.addEventListener("click", () => { panel.hidden = !panel.hidden; launcher.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) search.focus(); });
  panel.querySelector("[data-close]")?.addEventListener("click", () => { panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); });
  panel.addEventListener("change", () => onChange({ enabled: panel.querySelector<HTMLInputElement>("[data-enabled]")!.checked, bilingual: panel.querySelector<HTMLInputElement>("[data-bilingual]")!.checked }));
  document.addEventListener("dd55:open-entry", event => {
    const id = (event as CustomEvent<string>).detail;
    const entry = compendiumEntries.find(item => item.id === id);
    if (!entry) return;
    panel.hidden = false; launcher.setAttribute("aria-expanded", "true"); showEntry(entry);
  });
}
