// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountPanel } from "../src/content/panel";
import { compendiumEntries } from "../src/services/srd-compendium";

describe("compendium SRD local", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(() => { vi.unstubAllGlobals(); });

  function search(value: string): void {
    const input = document.querySelector<HTMLInputElement>("[data-search]")!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("présente des catégories et des centaines de fiches", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    expect(document.querySelector("[data-type='spell']")?.textContent).toContain("391");
    expect(document.querySelector("[data-type='feat']")?.textContent).toContain("75");
    expect(document.querySelector("[data-type='rule']")?.textContent).toContain("70");
    expect(document.querySelector("[data-type='classes']")?.textContent).toContain("24");
    expect(document.querySelector("[data-type='equipment']")?.textContent).toContain("51");
    expect(document.querySelector("[data-type='origins']")?.textContent).toContain("13");
  });

  it("émet des préférences complètes quand les réglages changent", () => {
    const onChange = vi.fn();
    mountPanel({ enabled: true, bilingual: true }, onChange);
    const enabled = document.querySelector<HTMLInputElement>("[data-enabled]")!;
    const bilingual = document.querySelector<HTMLInputElement>("[data-bilingual]")!;
    enabled.checked = false;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith({ enabled: false, bilingual: true });
    bilingual.checked = false;
    bilingual.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith({ enabled: false, bilingual: false });
  });

  it("charge réellement les références suivantes dans l'onglet Tout", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("#dd55-launcher")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
    const before = document.querySelector("[data-load-more]")?.textContent;
    document.querySelector<HTMLButtonElement>("[data-load-more]")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(160);
    expect(document.querySelector("[data-load-more]")?.textContent).not.toBe(before);
  });

  it("parcourt les classes et ouvre une sous-classe", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    expect(document.querySelector<HTMLSelectElement>("[data-class-kind]")?.value).toBe("class");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(12);
    expect(document.querySelector("[data-entry-id='class-magicien']")).not.toBeNull();
    expect(document.querySelector("[data-results] [data-entry-id^='subclass-']")).toBeNull();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-magicien']")!.click();
    const subclassLink = document.querySelector<HTMLButtonElement>(".dd55-mastery-link [data-entry-id='subclass-evocateur']")!;
    expect(subclassLink).not.toBeNull();
    subclassLink.click();
    const detail = document.querySelector("[data-detail]")?.textContent ?? "";
    expect(detail).toContain("Sous-classe de Magicien");
    expect(detail).toContain("Évocateur érudit");
  });

  it("filtre les classes et sous-classes par type de fiche", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    const select = document.querySelector<HTMLSelectElement>("[data-class-kind]")!;
    select.value = "subclass";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(12);
    expect(document.querySelector("[data-results] [data-entry-id^='class-']")).toBeNull();
    expect(document.querySelector("[data-entry-id='subclass-evocateur']")).not.toBeNull();
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(24);
  });

  it("filtre les règles par type", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='rule']")!.click();
    const select = document.querySelector<HTMLSelectElement>("[data-rule-kind]")!;
    select.value = "État";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(15);
    expect(document.querySelector("[data-entry-id='rule-etat-aveugle']")).not.toBeNull();
    select.value = "Propriété d’arme";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(10);
    expect(document.querySelector("[data-entry-id='rule-propriete-arme-legere']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-clear-rule-filters]")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(70);
  });

  it("affiche la progression d’une classe comme un vrai tableau", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-barde']")!.click();
    const table = document.querySelector<HTMLTableElement>(".dd55-progression table")!;
    expect(table).not.toBeNull();
    expect(document.querySelectorAll(".dd55-start-card")).toHaveLength(2);
    expect(document.querySelector(".dd55-presentation")?.textContent).toContain("Personnage multiclassé");
    expect(document.querySelector(".dd55-progression-heading")?.textContent).toContain("Progression du Barde");
    expect(table.querySelectorAll("thead th")).toHaveLength(15);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(20);
    expect(table.querySelector("tbody tr")?.textContent).toContain("Inspiration bardique, Sorts");
  });

  it("affiche une vraie fiche de sort structurée", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Boule de feu");
    document.querySelector<HTMLButtonElement>("[data-entry-id='spell-boule-de-feu']")!.click();
    const detail = document.querySelector("[data-detail]")?.textContent ?? "";
    expect(detail).toContain("Sort de niveau 3");
    expect(detail).toContain("Évocation");
    expect(detail).toContain("Portée");
    expect(detail).toContain("45 m");
    expect(detail).toContain("8d6 dégâts de feu");
  });

  it("transforme la table textuelle des actions en lignes lisibles", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Actions");
    document.querySelector<HTMLButtonElement>("[data-entry-id='rule-actions']")!.click();
    expect(document.querySelectorAll(".dd55-action-item")).toHaveLength(12);
    expect(document.querySelector(".dd55-action-item dt")?.textContent).toBe("Attaque");
    expect(document.querySelector(".dd55-prose h4")?.textContent).toBe("Une chose à la fois");
  });

  it("sépare les paragraphes, encarts et listes des aptitudes de classe", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-barbare']")!.click();
    expect(document.querySelectorAll(".dd55-rule-point").length).toBeGreaterThan(3);
    expect(document.querySelectorAll(".dd55-bullets li").length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector(".dd55-rule-point")?.textContent).toContain("Résistance aux dégâts");
  });

  it("résout les variantes françaises vers le titre du SRD", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Éclair traçant");
    expect(document.querySelector("[data-entry-id='spell-rayon-tracant']")).not.toBeNull();
    expect(document.querySelector("a[href*='eclair-tracant']")).toBeNull();
  });

  it("propose AideDD uniquement pour une référence absente du SRD", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Chanceux");
    expect(document.querySelector("[data-external-url*='/feat/fr/chanceux']")).not.toBeNull();
  });

  it("affiche les 75 dons locaux et externes dans la catégorie Dons", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='feat']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("75");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(75);
    expect(document.querySelector("[data-load-more]")).toBeNull();
  });

  it("affiche les 391 sorts locaux et externes dans la catégorie Sorts", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='spell']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("391");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
    expect(document.querySelector("[data-load-more]")?.textContent).toContain("311 restantes");
  });

  it("retrouve un sort externe en anglais avec son lien AideDD français", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Armor of Agathys");
    const button = document.querySelector<HTMLButtonElement>("[data-external-url$='/spell/fr/armure-d-agathys']");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Armure d'Agathys");
    expect(button?.textContent).toContain("niveau 1");
  });

  it("retrouve un don enrichi en anglais avec son lien AideDD français", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Telekinetic");
    const link = document.querySelector<HTMLButtonElement>("[data-external-url*='/feat/fr/telekinesiste']");
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain("Télékinésiste");
  });

  it("ouvre AideDD via l'extension sans exposer de lien interceptable par Roll20", () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Crossbow Expert");
    const button = document.querySelector<HTMLButtonElement>("[data-external-url*='/feat/fr/maitre-arbaletrier']")!;
    expect(button.tagName).toBe("BUTTON");
    button.click();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "DD55_OPEN_EXTERNAL",
      url: "https://www.aidedd.org/feat/fr/maitre-arbaletrier"
    });
  });

  it("filtre les sorts simultanément par classe et par niveau", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='spell']")!.click();
    const filters = document.querySelector<HTMLElement>("[data-spell-filters]")!;
    expect(filters.hidden).toBe(false);
    const classSelect = document.querySelector<HTMLSelectElement>("[data-spell-class]")!;
    const levelSelect = document.querySelector<HTMLSelectElement>("[data-spell-level]")!;
    classSelect.value = "Magicien";
    classSelect.dispatchEvent(new Event("change"));
    levelSelect.value = "3";
    levelSelect.dispatchEvent(new Event("change"));
    const ids = [...document.querySelectorAll<HTMLElement>("[data-results] [data-entry-id]")].map(element => element.dataset.entryId);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const entry = compendiumEntries.find(item => item.id === id)!;
      expect(entry.tags).toContain("Magicien");
      expect(entry.meta.Niveau).toBe("3");
    }
    expect(document.querySelector("[data-results] .dd55-external")).toBeNull();
  });

  it("filtre l’équipement par type et maîtrise d’arme", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='equipment']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("51");
    const typeSelect = document.querySelector<HTMLSelectElement>("[data-equipment-type]")!;
    const masterySelect = document.querySelector<HTMLSelectElement>("[data-weapon-mastery]")!;
    typeSelect.value = "Arme de guerre à distance";
    typeSelect.dispatchEvent(new Event("change"));
    masterySelect.value = "Ouverture";
    masterySelect.dispatchEvent(new Event("change"));
    const ids = [...document.querySelectorAll<HTMLElement>("[data-results] [data-entry-id]")].map(element => element.dataset.entryId);
    expect(ids).toHaveLength(3);
    for (const id of ids) {
      const entry = compendiumEntries.find(item => item.id === id)!;
      expect(entry.meta["Type d’équipement"]).toBe("Arme de guerre à distance");
      expect(entry.meta["Botte d’arme"]).toBe("Ouverture");
    }
  });

  it("relie une arme à la règle de sa botte d’arme", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='equipment']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='equipment-weapon-pistolet']")!.click();
    expect(document.querySelector("[data-detail]")?.textContent).toContain("1d10 perforants");
    const masteryLink = document.querySelector<HTMLButtonElement>(".dd55-mastery-link [data-entry-id='rule-botte-ouverture']")!;
    expect(masteryLink).not.toBeNull();
    masteryLink.click();
    expect(document.querySelector("[data-detail] h2")?.textContent).toBe("Ouverture");
    expect(document.querySelector("[data-detail]")?.textContent).toContain("Page SRD 96");
  });

  it("parcourt les origines et ouvre le don accordé par un historique", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='origins']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("13");
    expect(document.querySelector("[data-entry-id='species-drakeide']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-entry-id='background-criminel']")!.click();
    expect(document.querySelector("[data-detail]")?.textContent).toContain("Discrétion et Escamotage");
    const featLink = document.querySelector<HTMLButtonElement>(".dd55-mastery-link [data-entry-id='feat-vigilant']")!;
    expect(featLink).not.toBeNull();
    featLink.click();
    expect(document.querySelector("[data-detail] h2")?.textContent).toBe("Vigilant");
  });

  it("affiche les lignages d’une espèce dans un tableau d’options", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='origins']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='species-elfe']")!.click();
    const options = document.querySelector<HTMLElement>(".dd55-options-table")!;
    expect(options).not.toBeNull();
    expect(options.textContent).toContain("Lignages elfiques");
    expect(options.textContent).toContain("Drow");
    expect(options.textContent).toContain("Haut-elfe");
    expect(options.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(options.textContent).not.toContain("Progression du Elfe");
    expect(options.querySelector(".dd55-progression-heading > span")).toBeNull();
  });

  it("filtre les origines entre espèces et historiques", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='origins']")!.click();
    const filters = document.querySelector<HTMLElement>("[data-origin-filters]")!;
    const select = document.querySelector<HTMLSelectElement>("[data-origin-kind]")!;
    expect(filters.hidden).toBe(false);
    select.value = "species";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(9);
    expect(document.querySelector("[data-results] [data-entry-id^='background-']")).toBeNull();
    select.value = "background";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(4);
    expect(document.querySelector("[data-results] [data-entry-id^='species-']")).toBeNull();
    document.querySelector<HTMLButtonElement>("[data-clear-origin-filters]")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(13);
  });

  it("agrandit et réduit le compendium sans perdre son état", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    const panel = document.querySelector<HTMLElement>("#dd55-companion")!;
    const expand = document.querySelector<HTMLButtonElement>("[data-expand]")!;
    const search = document.querySelector<HTMLInputElement>("[data-search]")!;
    search.value = "rage";
    search.dispatchEvent(new Event("input"));

    expand.click();
    expect(panel.classList.contains("is-expanded")).toBe(true);
    expect(expand.getAttribute("aria-pressed")).toBe("true");
    expect(expand.getAttribute("aria-label")).toBe("Réduire le compendium");
    expect(search.value).toBe("rage");

    expand.click();
    expect(panel.classList.contains("is-expanded")).toBe(false);
    expect(expand.getAttribute("aria-pressed")).toBe("false");
    expect(expand.getAttribute("aria-label")).toBe("Agrandir le compendium");
    expect(search.value).toBe("rage");
  });
});
