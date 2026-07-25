import { describe, expect, it } from "vitest";
import { feats, spells } from "../src/data/references";
import { findReference, normalizeName, referenceUrl } from "../src/services/reference-matcher";

describe("reference matcher", () => {
  it("normalise accents, apostrophes et suffixes", () => expect(normalizeName("  Flèche d’acide [PHB 2024]  ")).toBe("fleche dacide"));
  it("reconnaît un sort anglais avec suffixe", () => expect(findReference("Magic Missile (2024)", spells)?.nameFr).toBe("Projectile magique"));
  it("reconnaît un don français sans accents", () => expect(findReference("Tireur d'elite", feats)?.nameEn).toBe("Sharpshooter"));
  it("utilise le slug validé", () => expect(referenceUrl("spell", spells.find(s => s.id === "magic-missile")!)).toBe("https://www.aidedd.org/spell/fr/projectile-magique"));
});
