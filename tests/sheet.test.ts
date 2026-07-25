// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { enhanceSheet, isDnd2024Sheet } from "../src/content/sheet";

describe("sheet enhancement", () => {
  beforeEach(() => { document.body.innerHTML = `<main><div aria-label="D&D 2024 Character Sheet"><span>Strength</span><button>Magic Missile</button></div></main>`; });
  it("détecte explicitement une feuille 2024", () => expect(isDnd2024Sheet()).toBe(true));
  it("détecte la signature DOM réelle sans attribut explicite", () => { document.body.innerHTML = `<section><div>ABILITIES</div><div>AC/SPEED</div><div>FEATURES & TRAITS</div></section>`; expect(isDnd2024Sheet()).toBe(true); });
  it("traduit sans modifier les attributs", () => { enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelector("span")?.textContent).toBe("Force"); expect(document.querySelector("span")?.title).toBe("Strength"); });
  it("ajoute un lien sûr vers AideDD", () => { enhanceSheet(document, { enabled: true, bilingual: true }); const link = document.querySelector<HTMLAnchorElement>(".dd55-reference a"); expect(link?.href).toBe("https://www.aidedd.org/spell/fr/projectile-magique"); expect(link?.target).toBe("_blank"); });
  it("restaure le libellé quand désactivé", () => { enhanceSheet(document, { enabled: true, bilingual: true }); enhanceSheet(document, { enabled: false, bilingual: true }); expect(document.querySelector("span")?.textContent).toBe("Strength"); });
  it("reste idempotent lors des passages répétés", () => { enhanceSheet(document, { enabled: true, bilingual: true }); enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelectorAll(".dd55-reference")).toHaveLength(1); });
  it("traduit les nœuds imbriqués et les libellés abrégés", () => { document.body.innerHTML = `<div><section><strong><span>ABILITIES</span></strong></section><div>Short</div></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.body.textContent).toContain("CARACTÉRISTIQUES"); expect(document.body.textContent).toContain("Court"); });
});
