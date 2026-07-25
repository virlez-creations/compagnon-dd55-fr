import { describe, expect, it } from "vitest";
import { feats, spells } from "../src/data/references";
import { findReference, normalizeName, referenceUrl } from "../src/services/reference-matcher";

describe("reference matcher", () => {
  it("normalise accents, apostrophes et suffixes", () => expect(normalizeName("  Flèche d’acide [PHB 2024]  ")).toBe("fleche dacide"));
  it("reconnaît un sort anglais avec suffixe", () => expect(findReference("Magic Missile (2024)", spells)?.nameFr).toBe("Projectile magique"));
  it("reconnaît un don français sans accents", () => expect(findReference("Tireur d'elite", feats)?.nameEn).toBe("Sharpshooter"));
  it("utilise le slug validé", () => expect(referenceUrl("spell", spells.find(s => s.id === "magic-missile")!)).toBe("https://www.aidedd.org/spell/fr/projectile-magique"));
  it.each([
    ["charger", "expert-de-la-charge"],
    ["crossbow-expert", "maitre-arbaletrier"],
    ["fey-touched", "affinite-feerique"],
    ["grappler", "empoigneur"],
    ["great-weapon-master", "maitre-des-armes-lourdes-cogneur-lourd"],
    ["inspiring-leader", "figure-de-proue"],
    ["lightly-armored", "protection-legere"],
    ["mobile", "mobile"],
    ["polearm-master", "maitre-d-hast"],
    ["spell-sniper", "incantateur-d-elite"],
    ["durable", "gaillard"],
    ["tough", "robuste"]
  ])("utilise le lien AideDD publié pour %s", (id, slug) => {
    expect(referenceUrl("feat", feats.find(feat => feat.id === id)!)).toBe(`https://www.aidedd.org/feat/fr/${slug}`);
  });
  it("référence les 75 dons AideDD sans identifiant ni lien en double", () => {
    expect(feats).toHaveLength(75);
    expect(new Set(feats.map(feat => feat.id)).size).toBe(75);
    expect(new Set(feats.map(feat => referenceUrl("feat", feat))).size).toBe(75);
  });
});
