// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { enhanceSheet, isDnd2024Sheet } from "../src/content/sheet";

describe("sheet enhancement", () => {
  beforeEach(() => { document.body.innerHTML = `<main><div aria-label="D&D 2024 Character Sheet"><span>Strength</span><button>Magic Missile</button></div></main>`; });
  it("détecte explicitement une feuille 2024", () => expect(isDnd2024Sheet()).toBe(true));
  it("détecte la signature DOM réelle sans attribut explicite", () => { document.body.innerHTML = `<section><div>ABILITIES</div><div>AC/SPEED</div><div>FEATURES & TRAITS</div></section>`; expect(isDnd2024Sheet()).toBe(true); });
  it("traduit sans modifier les attributs", () => { enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelector("span")?.textContent).toBe("Force"); expect(document.querySelector("span")?.title).toBe("Strength"); });
  it("ouvre la fiche locale lorsqu’elle existe dans le SRD", () => { enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelector(".dd55-reference [data-dd55-open='spell-projectile-magique']")).not.toBeNull(); expect(document.querySelector(".dd55-reference a")).toBeNull(); });
  it("restaure le libellé quand désactivé", () => { enhanceSheet(document, { enabled: true, bilingual: true }); enhanceSheet(document, { enabled: false, bilingual: true }); expect(document.querySelector("span")?.textContent).toBe("Strength"); });
  it("reste idempotent lors des passages répétés", () => { enhanceSheet(document, { enabled: true, bilingual: true }); enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelectorAll(".dd55-reference")).toHaveLength(1); });
  it("traduit les nœuds imbriqués et les libellés abrégés", () => { document.body.innerHTML = `<div><section><strong><span>ABILITIES</span></strong></section><div>Short</div></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.body.textContent).toContain("CARACTÉRISTIQUES"); expect(document.body.textContent).toContain("Court"); });
  it("traduit les actions, états et capacités quelle que soit la casse", () => { document.body.innerHTML = `<div><span>BLINDED</span><span>Dash</span><span>Extra Attack</span><span>Class Features</span></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.body.textContent).toContain("Aveuglé"); expect(document.body.textContent).toContain("Foncer"); expect(document.body.textContent).toContain("Attaque supplémentaire"); expect(document.body.textContent).toContain("Capacités de classe"); });
  it("traduit les libellés dynamiques de Roll20", () => { document.body.innerHTML = `<div><span>+8 Attack</span><span>30/120 ft</span><span>Level 4+</span><span>Prerequisite: Fighting Style Feature</span><span>New Item (Attack 2)</span></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); const text = document.body.textContent ?? ""; expect(text).toContain("+8 Attaque"); expect(text).toContain("30/120 pi"); expect(text).toContain("Niveau 4+"); expect(text).toContain("Prérequis : don Style de combat"); expect(text).toContain("Nouvel objet (Attaque 2)"); });
  it("traduit automatiquement les noms anglais issus du catalogue", () => {
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("button")?.childNodes[0].textContent).toBe("Projectile magique");
  });
  it("garde seulement le lien compact vers un sort développé", () => {
    document.body.innerHTML = `<div role="row"><h3>Fireball</h3><p>A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.</p></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("h3")?.childNodes[0].textContent).toBe("Boule de feu");
    expect(document.querySelector("[data-dd55-open='spell-boule-de-feu']")).not.toBeNull();
    expect(document.querySelector(".dd55-content-translation")).toBeNull();
  });
  it("reconnaît les noms de sorts imbriqués dans la structure réelle de Roll20", () => {
    document.body.innerHTML = `<div class="spell-row"><div class="spell-header"><span class="spell-name">Cure Wounds</span><span>Touch</span></div><div class="spell-details"><div>Duration: Instantaneous</div><div class="description">A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.</div></div></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    const name = document.querySelector<HTMLElement>(".spell-name")!;
    expect(name.childNodes[0].textContent).toBe("Soins");
    expect(name.querySelector("[data-dd55-open='spell-soins']")).not.toBeNull();
    expect(document.querySelector(".dd55-content-translation")).toBeNull();
  });
  it("relie Goodberry à la fiche locale Baies nourricières", () => {
    document.body.innerHTML = `<div role="row"><h3>Goodberry</h3></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    const name = document.querySelector("h3")!;
    expect(name.childNodes[0].textContent).toBe("Baies nourricières");
    expect(name.querySelector("[data-dd55-open='spell-baies-nourricieres']")).not.toBeNull();
    expect(name.querySelector("a")).toBeNull();
  });
  it("relie une aptitude à la bonne fiche de classe sans aperçu", () => {
    document.body.innerHTML = `<div>Ranger 4 - Hunter</div><div role="row"><h3>Favored Enemy</h3><p>You always have the Hunter's Mark spell prepared. You can cast it twice without expending a spell slot and regain all uses after a Long Rest.</p></div>`;
    enhanceSheet(document, { enabled: true, bilingual: false });
    expect(document.querySelector("h3")?.childNodes[0].textContent).toBe("Ennemi juré");
    expect(document.querySelector("[data-dd55-open='class-rodeur']")).not.toBeNull();
    expect(document.querySelector(".dd55-content-translation")).toBeNull();
  });
  it("retire les anciens aperçus déjà présents dans la page", () => {
    document.body.innerHTML = `<div role="row"><h3>Fireball</h3><details class="dd55-content-translation"><summary>Version française SRD</summary></details></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector(".dd55-content-translation")).toBeNull();
  });
  it("ne crée pas de référence de sort dans les commandes de points de vie", () => {
    document.body.innerHTML = `<section class="health-panel"><h2>HIT POINTS</h2><div><span>Current</span><span>Max</span><span>Temp</span></div><div><button>Damage</button><button id="heal-control">Heal</button></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#heal-control")?.textContent).toContain("Soigner");
    expect(document.querySelector(".dd55-reference")).toBeNull();
  });
  it("conserve la référence du sort Heal dans une vraie liste de sorts", () => {
    document.body.innerHTML = `<section><h2>Spells</h2><div role="row"><h3 id="heal-spell">Heal</h3><p>A creature regains Hit Points.</p></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#heal-spell .dd55-reference")).not.toBeNull();
  });
});
