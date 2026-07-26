import { expect, test, type Frame, type Page } from "@playwright/test";
import path from "node:path";

const bundlePath = path.resolve("dist/content.js");
const stylePath = path.resolve("dist/content.css");

const sheetSignature = `
  <div class="sheet-shell">
    <div>ABILITIES</div><div>AC/SPEED</div><div>FEATURES &amp; TRAITS</div>
  </div>`;

const profiles = [
  { role: "fighter", items: ["Sharpshooter", "Great Weapon Master"] },
  { role: "ranger", items: ["Goodberry", "Hunter's Mark"] },
  { role: "wizard", items: ["Magic Missile", "Shield", "Fireball"] },
  { role: "cleric", items: ["Bless", "Cure Wounds", "Guiding Bolt"] },
  { role: "rogue", items: ["Alert", "Lucky"] }
];

function profilesMarkup(): string {
  return profiles.map(profile => `<section data-profile="${profile.role}"><h2>${profile.role}</h2>${profile.items.map(item => `<button class="sheet-item">${item}</button>`).join("")}</section>`).join("");
}

async function loadBundle(page: Page): Promise<void> {
  await page.addStyleTag({ path: stylePath });
  await page.addScriptTag({ path: bundlePath });
  await expect(page.locator("#dd55-launcher")).toBeVisible();
}

async function loadBundleInFrame(frame: Frame): Promise<void> {
  await frame.addStyleTag({ path: stylePath });
  await frame.addScriptTag({ path: bundlePath });
}

test("traduit les cinq profils sans casser les contrôles Roll20", async ({ page }) => {
  await page.setContent(`${sheetSignature}<main>${profilesMarkup()}<input value="Magic Missile"><div contenteditable="true">Fireball</div><button id="roll20-action">Roll</button></main>`);
  await page.evaluate(() => {
    (window as typeof window & { roll20Clicks: number }).roll20Clicks = 0;
    document.querySelector("#roll20-action")?.addEventListener("click", () => (window as typeof window & { roll20Clicks: number }).roll20Clicks++);
  });
  await loadBundle(page);

  const expected = {
    fighter: ["Tireur d'élite", "Maître des armes lourdes"],
    ranger: ["Baies nourricières", "Marque du chasseur"],
    wizard: ["Projectile magique", "Bouclier", "Boule de feu"],
    cleric: ["Bénédiction", "Soins", "Rayon traçant"],
    rogue: ["Vigilant", "Chanceux"]
  };
  for (const [role, labels] of Object.entries(expected)) {
    const profile = page.locator(`[data-profile="${role}"]`);
    for (const label of labels) await expect(profile).toContainText(label);
    await expect(profile.locator(".dd55-reference")).toHaveCount(labels.length);
  }

  await expect(page.locator("main > input")).toHaveValue("Magic Missile");
  await expect(page.locator("[contenteditable='true']")).toHaveText("Fireball");
  await page.locator("#roll20-action").click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { roll20Clicks: number }).roll20Clicks)).toBe(1);
});

test("fonctionne dans la fiche intégrée, la fenêtre détachée et une iframe", async ({ page }) => {
  await page.setContent(`${sheetSignature}<button>Goodberry</button>`);
  await loadBundle(page);
  await expect(page.locator("body > button", { hasText: "Baies nourricières" })).toBeVisible();

  await page.goto("about:blank");
  await page.setContent(`${sheetSignature}<button>Magic Missile</button>`);
  await loadBundle(page);
  await expect(page.locator("body > button", { hasText: "Projectile magique" })).toBeVisible();

  await page.goto("about:blank");
  await page.setContent(`<iframe id="sheet"></iframe>`);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame());
  expect(frame).toBeTruthy();
  await frame!.setContent(`${sheetSignature}<button>Fireball</button>`);
  await loadBundleInFrame(frame!);
  await expect(frame!.locator("body > button", { hasText: "Boule de feu" })).toBeVisible();
  await expect(frame!.locator("#dd55-launcher")).toHaveCount(0);
});

test("ouvre le compendium local et expose le catalogue complet", async ({ page }) => {
  await page.setContent(`${sheetSignature}<button>Goodberry</button>`);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await expect(page.locator("#dd55-companion")).toBeVisible();
  await expect(page.locator(".dd55-tabs")).toContainText("Règles 70");
  await expect(page.locator(".dd55-tabs")).toContainText("Sorts 391");
  await expect(page.locator(".dd55-tabs")).toContainText("Dons 75");
  await expect(page.locator(".dd55-tabs")).toContainText("Équipement 51");
  await expect(page.locator(".dd55-tabs")).toContainText("Origines 13");

  await page.locator("[data-dd55-open='spell-baies-nourricieres']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Baies nourricières");
  await expect(page.locator("[data-detail]")).toContainText("Source : SRD 5.2.1 FR");
});

test("ouvre les propriétés d’arme et les états depuis les règles", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='rule']").click();
  await page.locator("[data-rule-kind]").selectOption("Propriété d’arme");
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(10);
  await page.locator("[data-search]").fill("Légère");
  await page.locator("[data-entry-id='rule-propriete-arme-legere']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Légère");
  await expect(page.locator("[data-detail]")).toContainText("attaque supplémentaire");
  await page.locator("[data-back]").click();
  await page.locator("[data-rule-kind]").selectOption("État");
  await page.locator("[data-search]").fill("Épuisement");
  await page.locator("[data-entry-id='rule-etat-epuisement']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Épuisement");
  await expect(page.locator("[data-detail]")).toContainText("Tests d20 affectés");
  await expect(page.locator("[data-detail]")).toContainText("niveau d’Épuisement atteint 6");
});

test("filtre les classes par défaut et ouvre la sous-classe liée", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='classes']").click();
  await expect(page.locator("[data-class-kind]")).toHaveValue("class");
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(12);
  await expect(page.locator("[data-results] [data-entry-id^='subclass-']")).toHaveCount(0);
  await page.locator("[data-entry-id='class-magicien']").click();
  await page.locator(".dd55-mastery-link [data-entry-id='subclass-evocateur']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Évocateur");
  await expect(page.locator("[data-detail]")).toContainText("Sous-classe de Magicien");
});

test("active et désactive les réglages de feuille sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent(`${sheetSignature}<span id="ability-label">Strength</span>`);
  await loadBundle(page);
  await expect(page.locator("#ability-label")).toHaveText("Force");
  await page.locator("#dd55-launcher").click();
  await page.locator(".dd55-settings summary").click();
  await page.locator("[data-enabled]").uncheck();
  await expect(page.locator("#ability-label")).toHaveText("Strength");
  await page.locator("[data-enabled]").check();
  await expect(page.locator("#ability-label")).toHaveText("Force");
  await page.locator("[data-bilingual]").uncheck();
  expect(errors).toEqual([]);
});

test("injecte les liens sans restrictions de panneau en mode diagnostic", async ({ page }) => {
  await page.setContent(`${sheetSignature}<div>Orc</div><section><div>EQUIPMENT</div><div role="row"><h3 id="dagger-item">Dagger</h3><span id="light-property">Light</span><span id="carried-state">Possession</span><span>1 lb</span><button>−</button><button>+</button></div></section><section><h2>Spells</h2><div role="row"><h3 id="light-spell">Light</h3></div></section><div role="row"><h3 id="species-feature">Adrenaline Rush</h3></div>`);
  await loadBundle(page);
  await expect(page.locator("#carried-state .dd55-reference")).toHaveCount(1);
  await expect(page.locator("#dagger-item .dd55-reference")).toHaveCount(0);
  await expect(page.locator("#light-property")).toContainText("Légère");
  await expect(page.locator("#light-property .dd55-reference")).toHaveCount(1);
  await expect(page.locator("#light-spell")).toContainText("Lumière");
  await expect(page.locator("#light-spell [data-dd55-open='spell-lumiere']")).toHaveCount(1);
  await expect(page.locator("#species-feature [data-dd55-open='species-orc']")).toHaveCount(1);
});

test("filtre l’équipement et ouvre la règle de maîtrise depuis une arme", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='equipment']").click();
  await page.locator("[data-equipment-type]").selectOption("Arme de guerre à distance");
  await page.locator("[data-weapon-mastery]").selectOption("Ouverture");
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(3);
  await page.locator("[data-entry-id='equipment-weapon-pistolet']").click();
  await expect(page.locator("[data-detail]")).toContainText("1d10 perforants");
  await page.locator(".dd55-mastery-link [data-entry-id='rule-botte-ouverture']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Ouverture");
  await expect(page.locator("[data-detail]")).toContainText("Page SRD 96");
});

test("ouvre une origine puis le don lié à son historique", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='origins']").click();
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(13);
  await page.locator("[data-origin-kind]").selectOption("background");
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(4);
  await page.locator("[data-origin-kind]").selectOption("");
  await page.locator("[data-entry-id='background-soldat']").click();
  await expect(page.locator("[data-detail]")).toContainText("Sauvagerie martiale");
  await page.locator(".dd55-mastery-link [data-entry-id='feat-sauvagerie-martiale']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Sauvagerie martiale");
  await page.locator("[data-back]").click();
  await page.locator("[data-entry-id='species-tieffelin']").click();
  await expect(page.locator(".dd55-options-table")).toContainText("Héritages fiélons");
  await expect(page.locator(".dd55-options-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".dd55-options-table .dd55-progression-heading > span")).toHaveCount(0);
});

test("reste absent hors d'une feuille D&D 2024 et charge les références suivantes", async ({ page }) => {
  await page.setContent(`<main><h1>Jeux à venir</h1><a href="/editor/">Lancer la partie</a></main>`);
  await page.addStyleTag({ path: stylePath });
  await page.addScriptTag({ path: bundlePath });
  await expect(page.locator("#dd55-launcher")).toHaveCount(0);

  await page.goto("about:blank");
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(80);
  const remainingBefore = await page.locator("[data-load-more] small").textContent();
  await page.locator("[data-load-more]").click();
  await expect(page.locator("[data-results] .dd55-entry-card")).toHaveCount(160);
  await expect(page.locator("[data-load-more] small")).not.toHaveText(remainingBefore ?? "");
});

test("apparaît sur une table moderne et peut être masqué, affiché et déplacé", async ({ page }) => {
  await page.setContent(`<main><h1>Table virtuelle</h1><div data-character-sheet="dnd2024byroll20"></div></main>`);
  await loadBundle(page);
  const launcher = page.locator("#dd55-launcher");

  await page.evaluate(() => document.dispatchEvent(new CustomEvent("dd55:toggle-launcher")));
  await expect(launcher).toBeHidden();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("dd55:toggle-launcher")));
  await expect(launcher).toBeVisible();

  const before = await launcher.boundingBox();
  expect(before).toBeTruthy();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x - 140, before!.y - 100, { steps: 5 });
  await page.mouse.up();
  const after = await launcher.boundingBox();
  expect(after).toBeTruthy();
  expect(after!.x).toBeLessThan(before!.x - 80);
  expect(after!.y).toBeLessThan(before!.y - 50);
  await expect(page.locator("#dd55-companion")).toBeHidden();
});
