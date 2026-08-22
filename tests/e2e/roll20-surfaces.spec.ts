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

test("tolère une double injection du script de contenu sans redéclaration ni doublon", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent(`${sheetSignature}<button>Goodberry</button>`);
  await loadBundle(page);
  await page.addScriptTag({ path: bundlePath });
  await expect(page.locator("#dd55-launcher")).toHaveCount(1);
  await expect(page.locator("body > button", { hasText: "Baies nourricières" })).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { __dd55ContentStarted?: boolean }).__dd55ContentStarted)).toBe(true);
});

test("ouvre le compendium local et expose le catalogue complet", async ({ page }) => {
  await page.setContent(`${sheetSignature}<button>Goodberry</button>`);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await expect(page.locator("#dd55-companion")).toBeVisible();
  await expect(page.locator(".dd55-tabs")).toContainText("Règles 70");
  await expect(page.locator(".dd55-tabs")).toContainText("Sorts 391");
  await expect(page.locator(".dd55-tabs")).toContainText("Dons 137");
  await expect(page.locator(".dd55-tabs")).toContainText("Équipement 51");
  await expect(page.locator(".dd55-tabs")).toContainText("Origines 13");
  await expect(page.locator(".dd55-tabs")).toContainText("Objets magiques 350");
  await expect(page.locator(".dd55-tabs")).toContainText("Monstres 330");

  await page.locator("[data-dd55-open='spell-baies-nourricieres']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Baies nourricières");
  await expect(page.locator("[data-detail]")).toContainText("Source : SRD 5.2.1 FR");
});

test("filtre les monstres et ouvre un profil DRS complet", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='monster']").click();
  await expect(page.locator("[data-result-count]")).toContainText("330 références");
  await expect(page.locator("[data-monster-advanced]")).toBeHidden();
  await page.locator("[data-monster-type]").selectOption("Aberration");
  await page.locator("[data-monster-fp-min]").selectOption("10");
  await page.locator("[data-monster-fp-max]").selectOption("10");
  await page.locator("[data-entry-id='monster-aboleth']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Aboleth");
  await expect(page.locator(".dd55-monster-abilities > div")).toHaveCount(6);
  await expect(page.locator(".dd55-monster-statblock")).toContainText("Créature légendaire");
});

test("prépare ou envoie les jets de monstre selon le réglage et conserve les brouillons", async ({ page }) => {
  await page.setContent(`${sheetSignature}<div id="textchat-input"><textarea></textarea><button id="chatSendBtn" class="btn">Envoyer</button></div>`);
  await page.evaluate(() => {
    const state = window as typeof window & { chatSends: number; copiedTexts: string[] };
    state.chatSends = 0;
    state.copiedTexts = [];
    document.querySelector("#chatSendBtn")?.addEventListener("click", () => state.chatSends++);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { state.copiedTexts.push(value); } }
    });
  });
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='monster']").click();
  await page.locator("[data-search]").fill("Aboleth");
  await page.locator("[data-entry-id='monster-aboleth']").click();
  const tentacle = page.locator(".dd55-monster-action").filter({ has: page.getByRole("heading", { name: "Tentacule", exact: true }) });
  await tentacle.locator("[data-monster-roll-action]").click();
  await expect(page.locator("#textchat-input textarea")).toHaveValue(/\/w gm &\{template:default\}.*Attaque 1=\[\[1d20\+9\]\]/);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { chatSends: number }).chatSends)).toBe(0);
  await expect(page.locator("[data-copy-status]")).toContainText("n’a pas été envoyée");

  await page.locator("#textchat-input textarea").fill("brouillon MJ");
  const memory = page.locator(".dd55-monster-action").filter({ has: page.getByRole("heading", { name: "Assimilation de mémoire", exact: true }) });
  await memory.locator("[data-monster-roll-action]").click();
  await expect(page.locator("#textchat-input textarea")).toHaveValue("brouillon MJ");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { copiedTexts: string[] }).copiedTexts.length)).toBe(1);
  expect(await page.evaluate(() => (window as typeof window & { copiedTexts: string[] }).copiedTexts[0])).toContain("Sauvegarde=Intelligence DD 16");

  await page.locator("#textchat-input textarea").fill("");
  await page.locator("[data-settings-open]").click();
  await page.locator("[data-auto-roll-monsters]").check();
  await page.locator("[data-settings-back]").click();
  await tentacle.locator("[data-monster-roll-action]").click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { chatSends: number }).chatSends)).toBe(1);
  await expect(page.locator("[data-copy-status]")).toContainText("Jet envoyé");
});

test("filtre les objets magiques et ouvre les fiches locales ou AideDD", async ({ page }) => {
  await page.setContent(sheetSignature);
  await page.evaluate(() => {
    const state = window as typeof window & { openedUrl?: string };
    (chrome as unknown as { runtime: { sendMessage: (message: { url?: string }) => Promise<void> } }).runtime = {
      sendMessage: (message) => { state.openedUrl = message.url; return Promise.resolve(); }
    };
  });
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='magic-item']").click();
  await expect(page.locator("[data-result-count]")).toContainText("350 références");
  await page.locator("[data-magic-rarity='Artefact']").click();
  await expect(page.locator("[data-results] .dd55-entry-card").first()).toContainText(/artefact/i);
  await page.locator("[data-clear-magic-item-filters]").click();
  await page.locator("[data-search]").fill("Amulette d’antidétection");
  await page.locator("[data-entry-id='magic-item-amulette-d-antidetection']").click();
  await expect(page.locator("[data-detail] h2")).toHaveText("Amulette d’antidétection");
  await expect(page.locator("[data-detail] [data-copy-target='all']")).toBeVisible();
  await page.locator("[data-back]").click();
  await page.locator("[data-search]").fill("Dark Shard Amulet");
  await page.locator("[data-external-url$='/magic-item/fr/amulette-de-sombre-eclat']").click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { openedUrl?: string }).openedUrl)).toBe("https://www.aidedd.org/magic-item/fr/amulette-de-sombre-eclat");
});

test("copie un bloc puis toute une fiche du compendium", async ({ page }) => {
  await page.setContent(`${sheetSignature}<button>Goodberry</button>`);
  await page.evaluate(() => {
    const state = window as typeof window & { copiedTexts: string[] };
    state.copiedTexts = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { state.copiedTexts.push(value); } }
    });
  });
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-dd55-open='spell-baies-nourricieres']").click();
  await page.locator("[data-copy-target='section-0']").click();
  await expect(page.locator("[data-copy-target='section-0']")).toContainText("✓ Copié");
  await page.locator("[data-copy-target='all']").click();
  await expect(page.locator("[data-copy-target='all']")).toContainText("✓ Copié");
  const copied = await page.evaluate(() => (window as typeof window & { copiedTexts: string[] }).copiedTexts);
  expect(copied).toHaveLength(2);
  expect(copied[0]).toContain("Dix baies");
  expect(copied[0]).not.toContain("Copier");
  expect(copied[1]).toContain("Baies nourricières");
  expect(copied[1]).toContain("Source : SRD 5.2.1 FR");
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
  await page.locator("[data-settings-open]").click();
  await expect(page.locator("[data-settings] h2")).toHaveText("Réglages");
  await page.locator("[data-enabled]").uncheck();
  await expect(page.locator("#ability-label")).toHaveText("Strength");
  await page.locator("[data-enabled]").check();
  await expect(page.locator("#ability-label")).toHaveText("Force");
  await page.locator("[data-bilingual]").uncheck();
  expect(errors).toEqual([]);
});

test("bascule instantanément la traduction dans les composants et les iframes", async ({ page }) => {
  const installStorageMock = async (context: Page | Frame) => context.evaluate(() => {
    type StorageListener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: "local") => void;
    const state = globalThis as typeof globalThis & { __dd55StorageListener?: StorageListener };
    const chromeMock = {
      runtime: { id: "test-extension", sendMessage: async () => undefined, onMessage: { addListener: () => undefined } },
      storage: {
        local: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: (listener: StorageListener) => { state.__dd55StorageListener = listener; } }
      }
    };
    const host = globalThis as unknown as { chrome?: Record<string, unknown> };
    if (host.chrome) Object.assign(host.chrome, chromeMock);
    else Object.defineProperty(globalThis, "chrome", { value: chromeMock, configurable: true });
  });
  await page.setContent(`${sheetSignature}<span id="compound">Strength <b>·</b> Dexterity</span><iframe id="sheet"></iframe>`);
  await installStorageMock(page);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.setContent(`${sheetSignature}<span id="frame-compound">Strength <b>·</b> Dexterity</span>`);
  await installStorageMock(frame);
  await loadBundleInFrame(frame);
  await loadBundle(page);
  await expect(page.locator("#compound")).toHaveText("Force · Dextérité");
  await expect(frame.locator("#frame-compound")).toHaveText("Force · Dextérité");

  await page.locator("#dd55-launcher").click();
  await page.locator("[data-settings-open]").click();
  await page.locator("[data-enabled]").uncheck();
  await expect(page.locator("#compound")).toHaveText("Strength · Dexterity");
  await frame.evaluate(() => (globalThis as typeof globalThis & { __dd55StorageListener?: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: "local") => void }).__dd55StorageListener?.({ enabled: { oldValue: true, newValue: false } }, "local"));
  await expect(frame.locator("#frame-compound")).toHaveText("Strength · Dexterity");

  await page.locator("[data-enabled]").check();
  await expect(page.locator("#compound")).toHaveText("Force · Dextérité");
  await frame.evaluate(() => (globalThis as typeof globalThis & { __dd55StorageListener?: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: "local") => void }).__dd55StorageListener?.({ enabled: { oldValue: false, newValue: true } }, "local"));
  await expect(frame.locator("#frame-compound")).toHaveText("Force · Dextérité");
});

test("garde les réglages dans le panneau et applique le thème sombre aux fiches", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await expect(page.locator("[data-settings-open] svg circle")).toHaveCount(1);
  await page.locator("[data-settings-open]").click();
  const bounds = await page.locator(".dd55-settings-content fieldset").nth(1).evaluate(fieldset => {
    const select = fieldset.querySelector("select")!;
    const fieldsetRect = fieldset.getBoundingClientRect();
    const selectRect = select.getBoundingClientRect();
    return { fieldsetRight: fieldsetRect.right, selectRight: selectRect.right, selectHeight: selectRect.height, fieldsetHeight: fieldsetRect.height, panelOverflow: fieldset.closest("#dd55-companion")!.scrollWidth - fieldset.closest("#dd55-companion")!.clientWidth };
  });
  expect(bounds.selectRight).toBeLessThanOrEqual(bounds.fieldsetRight);
  expect(bounds.selectHeight).toBe(38);
  expect(bounds.fieldsetHeight).toBeLessThan(280);
  expect(bounds.panelOverflow).toBe(0);
  const stickyGap = await page.locator("#dd55-companion").evaluate(panel => {
    panel.scrollTop = 100;
    return new Promise<number>(resolve => requestAnimationFrame(() => resolve(Math.abs(panel.querySelector(".dd55-settings-toolbar")!.getBoundingClientRect().top - panel.getBoundingClientRect().top))));
  });
  expect(stickyGap).toBeLessThanOrEqual(1);

  await page.locator("[data-setting-theme]").selectOption("dark");
  await expect(page.locator(".dd55-settings-content legend").first()).toHaveCSS("border-bottom-width", "0px");
  const contrastRatio = async (foregroundSelector: string, backgroundSelector: string) => page.evaluate(({ foregroundSelector, backgroundSelector }) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (rgb: number[]) => {
      const channels = rgb.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    const foreground = luminance(parse(getComputedStyle(document.querySelector(foregroundSelector)!).color));
    const background = luminance(parse(getComputedStyle(document.querySelector(backgroundSelector)!).backgroundColor));
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  }, { foregroundSelector, backgroundSelector });
  expect(await contrastRatio("[data-setting-theme]", "[data-setting-theme]")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-settings-content label", ".dd55-settings-content fieldset")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-settings-content legend", ".dd55-settings-content fieldset")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-switch small", ".dd55-settings-content fieldset")).toBeGreaterThanOrEqual(4.5);
  await page.locator("[data-settings-back]").click();
  expect(await contrastRatio(".dd55-tabs button small", "#dd55-companion")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-entry-main strong", ".dd55-entry-card")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-entry-main small", ".dd55-entry-card")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-entry-main > span", ".dd55-entry-card")).toBeGreaterThanOrEqual(4.5);
  await page.locator("[data-type='origins']").click();
  await page.locator("[data-entry-id='species-orc']").click();
  await expect(page.locator("#dd55-companion")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".dd55-meta-grid div").first()).toHaveCSS("background-color", "rgb(36, 36, 36)");
  await expect(page.locator(".dd55-article h3").first()).toHaveCSS("color", "rgb(255, 155, 146)");
  await expect(page.locator(".dd55-related")).toHaveCSS("background-color", "rgb(38, 38, 38)");
  expect(await contrastRatio(".dd55-meta-grid dt", ".dd55-meta-grid div")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-article p", "#dd55-companion")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-article h3", "#dd55-companion")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-related button", ".dd55-related")).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio(".dd55-source", "#dd55-companion")).toBeGreaterThanOrEqual(4.5);
});

test("affiche entièrement les textes des onglets et filtres en thème sombre", async ({ page }) => {
  await page.setViewportSize({ width: 590, height: 720 });
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-expand]").click();
  await page.locator("#dd55-companion").evaluate(panel => { (panel as HTMLElement).dataset.theme = "dark"; });

  const tabLayout = await page.locator(".dd55-tabs button").evaluateAll(buttons => buttons.map(button => {
    const element = button as HTMLElement;
    const style = getComputedStyle(element);
    const label = element.querySelector<HTMLElement>(".dd55-tab-label")!.getBoundingClientRect();
    const count = element.querySelector<HTMLElement>("small")!.getBoundingClientRect();
    return { text: element.textContent?.replace(/\s+/g, " ").trim(), whiteSpace: style.whiteSpace, flexDirection: style.flexDirection, overflow: element.scrollWidth - element.clientWidth, height: element.getBoundingClientRect().height, lineDelta: Math.abs((label.top + label.bottom) / 2 - (count.top + count.bottom) / 2) };
  }));
  expect(tabLayout.find(tab => tab.text === "Objets magiques 350")).toBeTruthy();
  expect(tabLayout.every(tab => tab.whiteSpace === "nowrap" && tab.flexDirection === "row" && tab.overflow <= 1 && tab.lineDelta <= 1)).toBe(true);
  expect(new Set(tabLayout.map(tab => Math.round(tab.height))).size).toBe(1);

  for (const [type, filter, heading] of [["classes", "[data-class-filters]", "Filtrer les classes"], ["feat", "[data-feat-filters]", "Filtrer les dons"]] as const) {
    await page.locator(`[data-type='${type}']`).click();
    await expect(page.locator(`${filter} > div:first-child > span`)).toHaveText(heading);
    const layout = await page.locator(filter).evaluate(element => {
      const container = element.getBoundingClientRect();
      return [...element.querySelectorAll<HTMLElement>("label > span, select")].map(child => {
        const rect = child.getBoundingClientRect();
        return { text: child instanceof HTMLSelectElement ? child.selectedOptions[0]?.textContent : child.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, containerLeft: container.left, containerRight: container.right, containerTop: container.top, containerBottom: container.bottom };
      });
    });
    expect(layout.every(item => Boolean(item.text?.trim()) && item.left >= item.containerLeft && item.right <= item.containerRight + 1 && item.top >= item.containerTop && item.bottom <= item.containerBottom + 1)).toBe(true);
  }
});

test("déplace le panneau par son en-tête et conserve sa position", async ({ page }) => {
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  const panel = page.locator("#dd55-companion");
  const header = page.locator("#dd55-companion > header");
  const before = (await panel.boundingBox())!;
  const headerBounds = (await header.boundingBox())!;
  await page.mouse.move(headerBounds.x + 120, headerBounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(headerBounds.x - 100, headerBounds.y + 30, { steps: 8 });
  await page.mouse.up();
  const after = (await panel.boundingBox())!;
  expect(after.x).toBeLessThan(before.x - 150);
  await page.locator("[data-close]").click();
  await page.locator("#dd55-launcher").click();
  expect((await panel.boundingBox())!.x).toBeCloseTo(after.x, 0);
});

test("conserve les liens hors des cadres de résumé ciblés", async ({ page }) => {
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

test("supprime les références des cadres résumé, points de vie, sens et maîtrises", async ({ page }) => {
  await page.setContent(`${sheetSignature}<section class="character-summary"><span>Rogue 3</span><span>Exp: 0/2700</span><span>Proficiency Bonus +2</span><button>Inspiration</button><button>Initiative</button></section><section class="health-panel"><h2>HIT POINTS</h2><span>Current</span><span>Maximum</span><button>Damage</button><button id="heal-summary">Heal</button></section><section class="senses-panel"><h2>SENSES</h2><span id="darkvision-summary">Darkvision</span></section><section class="proficiencies-panel"><h2>PROFICIENCIES & LANGUAGES</h2><span id="light-summary">Light</span></section><section><h2>Spells</h2><h3 id="real-heal-spell">Heal</h3></section>`);
  await loadBundle(page);
  await expect(page.locator(".character-summary .dd55-reference, .health-panel .dd55-reference, .senses-panel .dd55-reference, .proficiencies-panel .dd55-reference")).toHaveCount(0);
  await expect(page.locator("#real-heal-spell [data-dd55-open='spell-guerison']")).toHaveCount(1);
});

test("garde les filtres avancés des monstres lisibles sur un panneau étroit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.setContent(sheetSignature);
  await loadBundle(page);
  await page.locator("#dd55-launcher").click();
  await page.locator("[data-type='monster']").click();
  await page.locator("[data-monster-advanced-toggle]").click();
  const layout = await page.locator("#dd55-companion").evaluate(panel => {
    const advanced = panel.querySelector<HTMLElement>("[data-monster-advanced]")!;
    const bounds = panel.getBoundingClientRect();
    const controls = [...advanced.querySelectorAll<HTMLElement>("select, input")].map(control => {
      const rect = control.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    return { overflow: panel.scrollWidth - panel.clientWidth, controls, left: bounds.left, right: bounds.right };
  });
  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.controls.every(control => control.left >= layout.left && control.right <= layout.right + 1)).toBe(true);
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
