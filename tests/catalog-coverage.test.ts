// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { enhanceSheet } from "../src/content/sheet";
import { feats, spells } from "../src/data/references";
import { translations } from "../src/data/translations";
import { referenceUrl } from "../src/services/reference-matcher";
import { compendiumEntries } from "../src/services/srd-compendium";

describe("couverture du catalogue 2024", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("contient les 391 sorts et les 75 dons sans doublon", () => {
    expect(spells).toHaveLength(391);
    expect(feats).toHaveLength(75);
    expect(new Set(spells.map(spell => spell.id)).size).toBe(391);
    expect(new Set(spells.map(spell => spell.slug)).size).toBe(391);
    expect(new Set(feats.map(feat => feat.id)).size).toBe(75);
    expect(new Set(feats.map(feat => feat.slug)).size).toBe(75);
  });

  it("relie exactement 339 sorts au SRD et 52 sorts à AideDD", () => {
    const local = spells.filter(spell => spell.compendiumId);
    const external = spells.filter(spell => !spell.compendiumId);
    expect(local).toHaveLength(339);
    expect(external).toHaveLength(52);
    for (const spell of local) {
      const entry = compendiumEntries.find(candidate => candidate.id === spell.compendiumId);
      expect(entry?.type, spell.nameEn).toBe("spell");
    }
    for (const spell of external) {
      expect(referenceUrl("spell", spell), spell.nameEn).toBe(`https://www.aidedd.org/spell/fr/${spell.slug}`);
    }
  });

  it("reconnaît et enrichit chaque nom anglais du catalogue sur une fiche", () => {
    const fragment = document.createDocumentFragment();
    for (const spell of spells) {
      const button = document.createElement("button");
      button.dataset.catalogSpell = spell.id;
      button.textContent = spell.nameEn;
      fragment.append(button);
    }
    document.body.append(fragment);
    enhanceSheet(document, { enabled: true, bilingual: true });

    for (const spell of spells) {
      const button = document.querySelector<HTMLElement>(`[data-catalog-spell="${spell.id}"]`)!;
      expect(button.textContent, spell.nameEn).toContain(spell.nameFr);
      if (spell.compendiumId) {
        expect(button.querySelector(`[data-dd55-open="${spell.compendiumId}"]`), spell.nameEn).not.toBeNull();
      } else {
        expect(button.querySelector<HTMLAnchorElement>("a")?.href, spell.nameEn).toBe(referenceUrl("spell", spell));
      }
    }
  });

  it("dépasse le seuil MVP de 80 libellés d'interface", () => {
    expect(Object.keys(translations).length).toBeGreaterThanOrEqual(80);
  });
});
