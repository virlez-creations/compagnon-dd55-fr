// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enhanceSheet, isDnd2024Sheet } from "../src/content/sheet";

describe("sheet enhancement", () => {
  beforeEach(() => { document.body.innerHTML = `<main><div aria-label="D&D 2024 Character Sheet"><span>Strength</span><button>Magic Missile</button></div></main>`; });
  afterEach(() => vi.unstubAllGlobals());
  it("détecte explicitement une feuille 2024", () => expect(isDnd2024Sheet()).toBe(true));
  it("détecte la signature DOM réelle sans attribut explicite", () => { document.body.innerHTML = `<section><div>ABILITIES</div><div>AC/SPEED</div><div>FEATURES & TRAITS</div></section>`; expect(isDnd2024Sheet()).toBe(true); });
  it("traduit sans modifier les attributs", () => { enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelector("span")?.textContent).toBe("Force"); expect(document.querySelector("span")?.title).toBe("Strength"); });
  it("ouvre la fiche locale lorsqu’elle existe dans le SRD", () => { enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelector(".dd55-reference [data-dd55-open='spell-projectile-magique']")).not.toBeNull(); expect(document.querySelector(".dd55-reference a")).toBeNull(); });
  it("affiche uniquement l’icône livre pour une référence", () => { enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelector(".dd55-reference")?.textContent).toBe("📖"); });
  it("ouvre directement le compendium local même lorsque Chrome est disponible", () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", { runtime: { id: "extension-test", sendMessage } });
    document.body.insertAdjacentHTML("beforeend", `<aside id="dd55-companion"></aside>`);
    let opened = "";
    document.addEventListener("dd55:open-entry", event => { opened = (event as CustomEvent<string>).detail; }, { once: true });
    enhanceSheet(document, { enabled: true, bilingual: true });
    document.querySelector<HTMLElement>("[data-dd55-open='spell-projectile-magique']")!.click();
    expect(opened).toBe("spell-projectile-magique");
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("restaure le libellé quand désactivé", () => { enhanceSheet(document, { enabled: true, bilingual: true }); enhanceSheet(document, { enabled: false, bilingual: true }); expect(document.querySelector("span")?.textContent).toBe("Strength"); });
  it("restaure instantanément tous les fragments d’un même composant", () => {
    document.body.innerHTML = `<div aria-label="D&D 2024 Character Sheet"><span id="compound">Strength <b aria-hidden="true">·</b> Dexterity</span></div>`;
    const compound = document.querySelector("#compound")!;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(compound.textContent).toContain("Force");
    expect(compound.textContent).toContain("Dextérité");
    enhanceSheet(document, { enabled: false, bilingual: true });
    expect(compound.textContent).toBe("Strength · Dexterity");
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(compound.textContent).toBe("Force · Dextérité");
  });
  it("reste idempotent lors des passages répétés", () => { enhanceSheet(document, { enabled: true, bilingual: true }); enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.querySelectorAll(".dd55-reference")).toHaveLength(1); });
  it("traduit les nœuds imbriqués et les libellés abrégés", () => { document.body.innerHTML = `<div><section><strong><span>ABILITIES</span></strong></section><div>Short</div></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.body.textContent).toContain("CARACTÉRISTIQUES"); expect(document.body.textContent).toContain("Court"); });
  it("traduit les actions, états et capacités quelle que soit la casse", () => { document.body.innerHTML = `<div><span>BLINDED</span><span>Dash</span><span>Extra Attack</span><span>Class Features</span></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); expect(document.body.textContent).toContain("Aveuglé"); expect(document.body.textContent).toContain("Foncer"); expect(document.body.textContent).toContain("Attaque supplémentaire"); expect(document.body.textContent).toContain("Capacités de classe"); });
  it("traduit les libellés dynamiques de Roll20", () => { document.body.innerHTML = `<div><span>+8 Attack</span><span>30/120 ft</span><span>Level 4+</span><span>Prerequisite: Fighting Style Feature</span><span>New Item (Attack 2)</span></div>`; enhanceSheet(document, { enabled: true, bilingual: true }); const text = document.body.textContent ?? ""; expect(text).toContain("+8 Attaque"); expect(text).toContain("30/120 pi"); expect(text).toContain("Niveau 4+"); expect(text).toContain("Prérequis : don Style de combat"); expect(text).toContain("Nouvel objet (Attaque 2)"); });
  it("traduit les huit maîtrises d’arme dans leur contexte Roll20", () => {
    document.body.innerHTML = `<div class="weapon-mastery"><strong>Weapon Mastery</strong>${["Nick", "Graze", "Cleave", "Vex", "Push", "Slow", "Topple", "Sap"].map(name => `<span>${name}</span>`).join("")}</div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    const text = document.body.textContent ?? "";
    for (const name of ["Coup double", "Écorchure", "Enchaînement", "Ouverture", "Poussée", "Ralentissement", "Renversement", "Sape"]) expect(text).toContain(name);
    expect(text).toContain("Bottes d’arme");
  });
  it("traduit une maîtrise combinée mais ne transforme pas un prénom isolé", () => {
    document.body.innerHTML = `<div><span>Mastery: Vex</span><span id="character-name">Nick</span></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.body.textContent).toContain("Botte d’arme : Ouverture");
    expect(document.querySelector("#character-name")?.textContent).toBe("Nick");
  });
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
  it("injecte aussi les références dans les commandes de points de vie en mode sans restrictions", () => {
    document.body.innerHTML = `<section class="health-panel"><h2>HIT POINTS</h2><div><span>Current</span><span>Max</span><span>Temp</span></div><div><button>Damage</button><button id="heal-control">Heal</button></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#heal-control")?.textContent).toContain("Soigner");
    expect(document.querySelector("#heal-control [data-dd55-open='spell-guerison']")).not.toBeNull();
  });
  it("conserve la référence du sort Heal dans une vraie liste de sorts", () => {
    document.body.innerHTML = `<section><h2>Spells</h2><div role="row"><h3 id="heal-spell">Heal</h3><p>A creature regains Hit Points.</p></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#heal-spell .dd55-reference")).not.toBeNull();
  });
  it("injecte les homonymes dans l’inventaire en mode sans restrictions", () => {
    document.body.innerHTML = `<section class="inventory-panel"><h2>INVENTORY</h2><div role="row"><h3>Explorer's Pack</h3><span id="carried-state">Possession</span><span>7 lbs</span><button>−</button><button>+</button></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#carried-state .dd55-reference")).not.toBeNull();
    expect(document.querySelector("[data-dd55-open='spell-possession']")).not.toBeNull();
  });
  it("ne crée aucun lien sur une arme d’inventaire", () => {
    document.body.innerHTML = `<section class="inventory-panel"><h2>INVENTORY</h2><div role="row"><h3 id="item-name">Dagger</h3><span>Possession</span><span>1 lb</span><button>−</button><button>+</button></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#item-name")?.childNodes[0].textContent).toBe("Dague");
    expect(document.querySelector("#item-name .dd55-reference")).toBeNull();
  });
  it("laisse volontairement le lien Lumière sur la propriété Light en mode sans restrictions", () => {
    document.body.innerHTML = `<section class="equipment-panel"><h2>EQUIPMENT</h2><div role="row"><h3 id="weapon-name">Hand Crossbow</h3><span id="light-property">Light</span><span>6 lbs</span><button>−</button><button>+</button></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#light-property")?.childNodes[0].textContent).toBe("Légère");
    expect(document.querySelector("#light-property .dd55-reference")).not.toBeNull();
    expect(document.querySelector("#weapon-name .dd55-reference")).toBeNull();
  });
  it("conserve Light comme sort Lumière dans une vraie liste de sorts", () => {
    document.body.innerHTML = `<section><h2>Spells</h2><div role="row"><h3 id="light-spell">Light</h3></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#light-spell")?.childNodes[0].textContent).toBe("Lumière");
    expect(document.querySelector("#light-spell [data-dd55-open='spell-lumiere']")).not.toBeNull();
  });
  it("injecte les liens dans Armure, Sens et Maîtrises et langues en mode sans restrictions", () => {
    document.body.innerHTML = `<div>Orc</div><section><div>ARMOR</div><div id="armor-reference">Alert</div></section><section><div>SENSES</div><div id="sense-reference">Darkvision</div></section><section><div>PROFICIENCIES & LANGUAGES</div><div id="proficiency-reference">Magic Missile</div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#armor-reference .dd55-reference")).not.toBeNull();
    expect(document.querySelector("#sense-reference .dd55-reference")).not.toBeNull();
    expect(document.querySelector("#proficiency-reference .dd55-reference")).not.toBeNull();
    expect(document.querySelector("#proficiency-reference")?.childNodes[0].textContent).toBe("Projectile magique");
  });
  it("conserve les anciens liens injectés en mode sans restrictions", () => {
    document.body.innerHTML = `<section><div>EQUIPMENT</div><div id="equipment-entry">Dagger<span class="dd55-reference"><span data-dd55-open="equipment-weapon-dague">Compendium</span></span></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#equipment-entry .dd55-reference")).not.toBeNull();
  });
  it("reconnaît une ligne Roll20 par son poids et ses contrôles même sans panneau identifiable", () => {
    document.body.innerHTML = `<div role="row"><span id="real-light-property">Light</span><span>6 lbs</span><button>−</button><button>+</button></div><div role="row"><span id="real-possession-state">Possession<span class="dd55-reference"><span data-dd55-open="spell-possession">Compendium</span></span></span><button>−</button><button>+</button></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#real-light-property")?.childNodes[0].textContent).toBe("Légère");
    expect(document.querySelector("#real-light-property .dd55-reference")).not.toBeNull();
    expect(document.querySelector("#real-possession-state .dd55-reference")).not.toBeNull();
  });
  it("reconnaît Light parmi les pastilles de propriétés même si les contrôles sont éloignés", () => {
    document.body.innerHTML = `<div><div>Ranged Weapon, Gear</div><div><span>Ammunition (Range 30/120; Bolt)</span><span id="nested-light-property">Light</span><span>Loading</span><span>Proficient</span></div></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#nested-light-property")?.childNodes[0].textContent).toBe("Légère");
    expect(document.querySelector("#nested-light-property .dd55-reference")).not.toBeNull();
  });
  it("relie les aptitudes d’espèce à la bonne fiche d’origine", () => {
    document.body.innerHTML = `<div>Orc</div><div role="row"><h3 id="adrenaline">Adrenaline Rush</h3></div><div role="row"><h3 id="darkvision">Darkvision</h3></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#adrenaline")?.childNodes[0].textContent).toBe("Poussée d’adrénaline");
    expect(document.querySelector("#adrenaline [data-dd55-open='species-orc']")).not.toBeNull();
    expect(document.querySelector("#darkvision [data-dd55-open='species-orc']")).not.toBeNull();
  });

  it("traduit les nouveaux équipements, origines et variantes du compendium", () => {
    document.body.innerHTML = `<section class="inventory-panel"><h2>INVENTORY</h2><div role="row"><h3 id="weapon">Greatsword</h3><span id="property">Two-Handed</span><span>6 lbs</span><button>−</button><button>+</button></div></section><div id="armor">Chain Mail</div><div id="background">Soldier</div><div id="lineage">Wood Elf</div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#weapon")?.childNodes[0].textContent).toBe("Épée à deux mains");
    expect(document.querySelector("#property")?.textContent).toBe("Deux mains");
    expect(document.querySelector("#armor")?.textContent).toBe("Cotte de mailles");
    expect(document.querySelector("#background")?.textContent).toBe("Soldat");
    expect(document.querySelector("#lineage")?.textContent).toBe("Elfe sylvestre");
    expect(document.querySelector("#weapon .dd55-reference")).toBeNull();
  });

  it("traduit et relie les nouvelles aptitudes de classe", () => {
    document.body.innerHTML = `<div>Ranger 10 - Hunter</div><div role="row"><h3 id="feature">Tireless</h3></div>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#feature")?.childNodes[0].textContent).toBe("Infatigable");
    expect(document.querySelector("#feature [data-dd55-open='class-rodeur']")).not.toBeNull();
  });

  it("conserve les liens de sorts pendant une mise à jour partielle d’un autre panneau", () => {
    document.body.innerHTML = `<main><div><div>Spells</div><div role="row"><h3 id="spell-name">Goodberry</h3></div></div><div id="senses"><div>SENSES</div><div>Darkvision</div></div></main>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    expect(document.querySelector("#spell-name [data-dd55-open='spell-baies-nourricieres']")).not.toBeNull();

    const senses = document.querySelector<HTMLElement>("#senses")!;
    senses.append(document.createElement("span"));
    enhanceSheet(senses, { enabled: true, bilingual: true });

    expect(document.querySelector("#spell-name [data-dd55-open='spell-baies-nourricieres']")).not.toBeNull();
  });

  it("remplace un lien lorsque Roll20 recycle une ligne pour un autre sort", () => {
    document.body.innerHTML = `<section><div>Spells</div><div role="row"><h3 id="recycled-spell">Goodberry</h3></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    const name = document.querySelector<HTMLElement>("#recycled-spell")!;
    expect(name.querySelector("[data-dd55-open='spell-baies-nourricieres']")).not.toBeNull();

    name.childNodes[0].textContent = "Fireball";
    enhanceSheet(name, { enabled: true, bilingual: true });

    expect(name.querySelector("[data-dd55-open='spell-boule-de-feu']")).not.toBeNull();
    expect(name.querySelector("[data-dd55-open='spell-baies-nourricieres']")).toBeNull();
  });

  it("conserve un lien de secours cliquable si Roll20 supprime le badge enfant", () => {
    document.body.innerHTML = `<section><div>Spells</div><div role="row"><h3 id="resilient-link">Goodberry</h3></div></section>`;
    enhanceSheet(document, { enabled: true, bilingual: true });
    const name = document.querySelector<HTMLElement>("#resilient-link")!;
    name.querySelector(".dd55-reference")?.remove();
    expect(name.classList.contains("dd55-reference-host")).toBe(true);
    expect(name.dataset.dd55LinkEntry).toBe("spell-baies-nourricieres");

    let opened = "";
    document.addEventListener("dd55:open-entry", event => { opened = (event as CustomEvent<string>).detail; }, { once: true });
    name.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 0 }));
    expect(opened).toBe("spell-baies-nourricieres");
  });
});
