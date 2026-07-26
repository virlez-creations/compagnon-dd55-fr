import { describe, expect, it } from "vitest";
import { compendiumEntries, findCompendiumEntry, searchCompendiumResults } from "../src/services/srd-compendium";

describe("données du compendium", () => {
  it("classe la recherche par pertinence et tolère les variantes de saisie", () => {
    expect(searchCompendiumResults("feu boule", "spell")[0].entry.id).toBe("spell-boule-de-feu");
    expect(searchCompendiumResults("epuisemant", "rule").some(result => result.entry.id === "rule-etat-epuisement")).toBe(true);
    expect(searchCompendiumResults("boule feu 45 m", "spell")[0].entry.id).toBe("spell-boule-de-feu");
  });

  it("retrouve une fiche depuis son contenu et fournit un extrait", () => {
    const result = searchCompendiumResults("8d6 dégâts feu", "spell").find(item => item.entry.id === "spell-boule-de-feu");
    expect(result?.matchedFields).toContain("content");
    expect(result?.excerpt).toContain("8d6");
  });

  it("contient les catalogues structurés attendus", () => {
    expect(compendiumEntries.filter(entry => entry.type === "spell").length).toBeGreaterThan(300);
    expect(compendiumEntries.filter(entry => entry.type === "feat").length).toBeGreaterThan(10);
    expect(compendiumEntries.filter(entry => entry.type === "rule").length).toBeGreaterThan(30);
    expect(compendiumEntries.filter(entry => entry.type === "class")).toHaveLength(12);
    expect(compendiumEntries.filter(entry => entry.type === "subclass")).toHaveLength(12);
    expect(compendiumEntries.filter(entry => entry.type === "equipment")).toHaveLength(51);
    expect(compendiumEntries.filter(entry => entry.id.startsWith("rule-botte-"))).toHaveLength(8);
    expect(compendiumEntries.filter(entry => entry.id.startsWith("rule-propriete-arme-"))).toHaveLength(10);
    expect(compendiumEntries.filter(entry => entry.id.startsWith("rule-etat-"))).toHaveLength(15);
    expect(compendiumEntries.filter(entry => entry.type === "species")).toHaveLength(9);
    expect(compendiumEntries.filter(entry => entry.type === "background")).toHaveLength(4);
  });

  it("expose les propriétés d’arme et les états comme règles structurées", () => {
    expect(findCompendiumEntry("Légère", "rule")?.sections[0].content).toContain("attaque supplémentaire");
    expect(findCompendiumEntry("Munitions", "rule")?.page).toBe(96);
    expect(findCompendiumEntry("À terre", "rule")?.sections.map(section => section.heading)).toContain("Déplacement limité");
    expect(findCompendiumEntry("Épuisement", "rule")?.sections).toHaveLength(4);
    expect(findCompendiumEntry("Paralysé", "rule")?.sections).toHaveLength(5);
  });

  it("expose les métadonnées et le corps d’un sort", () => {
    const fireball = findCompendiumEntry("Boule de feu", "spell")!;
    expect(fireball.meta).toMatchObject({ Niveau: "3", École: "Évocation", Portée: "45 m" });
    expect(fireball.meta.Durée).toBe("instantanée");
    expect(fireball.sections.map(section => section.content).join(" ")).toContain("8d6 dégâts de feu");
  });

  it("résout les titres homonymes selon leur type", () => {
    expect(findCompendiumEntry("Soins", "spell")?.id).toBe("spell-soins");
    expect(findCompendiumEntry("Soins", "rule")?.id).toBe("rule-soins");
    expect(findCompendiumEntry("Amélioration de caractéristique", "feat")?.id).toBe("feat-amelioration-de-caracteristique");
  });

  it("expose les caractéristiques et la botte d’une arme", () => {
    const pistol = findCompendiumEntry("Pistolet", "equipment")!;
    expect(pistol.page).toBe(97);
    expect(pistol.meta).toMatchObject({
      "Type d’équipement": "Arme de guerre à distance",
      Dégâts: "1d10 perforants",
      "Botte d’arme": "Ouverture"
    });
    expect(findCompendiumEntry("Ouverture", "rule")?.id).toBe("rule-botte-ouverture");
  });

  it("structure les origines et relie les historiques à leur don", () => {
    const elf = findCompendiumEntry("Elfe", "species")!;
    expect(elf.meta).toMatchObject({ "Type de créature": "Humanoïde", Vitesse: "9 m" });
    expect(elf.sections.some(section => section.heading === "Lignage elfique")).toBe(true);
    const criminal = findCompendiumEntry("Criminel", "background")!;
    expect(criminal.meta["Don d’origine"]).toBe("Vigilant");
    expect(criminal.links).toEqual([{ label: "Don accordé par l’historique", entryId: "feat-vigilant", title: "Vigilant" }]);
  });

  it("présente les choix d’espèce dans des tableaux comparatifs", () => {
    const expectedRows: Record<string, number> = { Drakéide: 10, Elfe: 3, Gnome: 2, Goliath: 6, Tieffelin: 3 };
    for (const [name, rowCount] of Object.entries(expectedRows)) {
      const species = findCompendiumEntry(name, "species")!;
      expect(species.tables, name).toHaveLength(1);
      expect(species.tables![0].rows, name).toHaveLength(rowCount);
      expect(species.tables![0].headers.length, name).toBeGreaterThanOrEqual(2);
      expect(species.tables![0].rows.every(row => row.length === species.tables![0].headers.length), name).toBe(true);
    }
    expect(findCompendiumEntry("Halfelin", "species")?.tables).toBeUndefined();
  });

  it("résout le nom AideDD d’un don vers sa fiche SRD", () => {
    expect(findCompendiumEntry("Lutteur", "feat")?.id).toBe("feat-empoigneur");
  });

  it("structure les classes et relie les sous-classes", () => {
    const wizard = findCompendiumEntry("Magicien", "class")!;
    expect(wizard.meta).toMatchObject({ "Caractéristique principale": "Intelligence", "Dé de vie": "d6 par niveau de Magicien" });
    expect(wizard.meta).toMatchObject({ Armes: "Armes courantes", Armures: "Aucune" });
    expect(wizard.sections[0].heading).toBe("Présentation");
    expect(wizard.sections[0].content).toContain("Devenir Magicien");
    expect(wizard.sections[0].content).not.toContain("Caractéristique principale");
    expect(wizard.sections.some(section => section.heading?.includes("Niveau 1 · Sorts"))).toBe(true);
    const evoker = findCompendiumEntry("Évocateur", "subclass")!;
    expect(evoker.meta["Classe parente"]).toBe("Magicien");
    expect(evoker.sections.some(section => section.heading?.includes("Évocateur érudit"))).toBe(true);
  });

  it("fournit un tableau d’évolution complet pour chaque classe", () => {
    const classes = compendiumEntries.filter(entry => entry.type === "class");
    for (const entry of classes) {
      expect(entry.tables, entry.title).toHaveLength(1);
      const table = entry.tables![0];
      expect(table.headers.length, entry.title).toBeGreaterThanOrEqual(4);
      expect(table.rows, entry.title).toHaveLength(20);
      expect(table.rows.map(row => row[0]), entry.title).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 1)));
      expect(table.rows.every(row => row.length === table.headers.length), entry.title).toBe(true);
    }
  });

  it("conserve les colonnes de sorts du Barde sans doublon textuel", () => {
    const bard = findCompendiumEntry("Barde", "class")!;
    expect(bard.tables![0].headers).toHaveLength(15);
    expect(bard.tables![0].headers.slice(-9)).toEqual(Array.from({ length: 9 }, (_, index) => `Empl. ${index + 1}`));
    expect(bard.tables![0].rows[0].slice(0, 5)).toEqual(["1", "+2", "Inspiration bardique, Sorts", "d6", "2"]);
    expect(bard.sections.map(section => section.content).join(" ")).not.toContain("Emplacements par niveau de sort");
  });

  it("ne concatène plus les catalogues de sorts aux aptitudes de classe", () => {
    for (const className of ["Barde", "Clerc", "Druide", "Ensorceleur", "Magicien", "Occultiste", "Paladin", "Rôdeur"]) {
      const entry = findCompendiumEntry(className, "class")!;
      const content = entry.sections.map(section => section.content).join(" ");
      expect(content, className).not.toContain("Cette section présente la liste de sorts");
    }
    expect(findCompendiumEntry("Barde", "class")!.sections.some(section => section.heading === "Niveau 1 · Sorts")).toBe(true);
  });
});
