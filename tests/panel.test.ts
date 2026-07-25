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
    expect(document.querySelector("[data-type='rule']")?.textContent).toContain("37");
    expect(document.querySelector("[data-type='classes']")?.textContent).toContain("24");
  });

  it("parcourt les classes et ouvre une sous-classe", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    expect(document.querySelector("[data-entry-id='class-magicien']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-entry-id='subclass-evocateur']")!.click();
    const detail = document.querySelector("[data-detail]")?.textContent ?? "";
    expect(detail).toContain("Sous-classe de Magicien");
    expect(detail).toContain("Évocateur érudit");
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
    expect(document.querySelectorAll("[data-results] [data-entry-id]")).toHaveLength(17);
    expect(document.querySelectorAll("[data-results] .dd55-external")).toHaveLength(58);
  });

  it("affiche les 391 sorts locaux et externes dans la catégorie Sorts", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='spell']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("391");
    expect(document.querySelectorAll("[data-results] [data-entry-id]")).toHaveLength(339);
    expect(document.querySelectorAll("[data-results] .dd55-external")).toHaveLength(52);
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
});
