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
  await expect(page.locator(".dd55-tabs")).toContainText("Sorts 391");
  await expect(page.locator(".dd55-tabs")).toContainText("Dons 75");

  await page.locator("[data-dd55-open='spell-baies-nourricieres']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Baies nourricières");
  await expect(page.locator("[data-detail]")).toContainText("Source : SRD 5.2.1 FR");
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
