import { describe, expect, it } from "vitest";
import { compendiumEntries, findCompendiumEntry } from "../src/services/srd-compendium";

describe("données du compendium", () => {
  it("contient les catalogues structurés attendus", () => {
    expect(compendiumEntries.filter(entry => entry.type === "spell").length).toBeGreaterThan(300);
    expect(compendiumEntries.filter(entry => entry.type === "feat").length).toBeGreaterThan(10);
    expect(compendiumEntries.filter(entry => entry.type === "rule").length).toBeGreaterThan(30);
    expect(compendiumEntries.filter(entry => entry.type === "class")).toHaveLength(12);
    expect(compendiumEntries.filter(entry => entry.type === "subclass")).toHaveLength(12);
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
