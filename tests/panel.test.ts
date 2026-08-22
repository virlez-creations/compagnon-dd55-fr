// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountPanel } from "../src/content/panel";
import { compendiumEntries } from "../src/services/srd-compendium";

describe("compendium SRD local", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Reflect.deleteProperty(document, "execCommand");
  });

  function search(value: string): void {
    const input = document.querySelector<HTMLInputElement>("[data-search]")!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("présente des catégories et des centaines de fiches", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    expect(document.querySelector("[data-type='spell']")?.textContent).toContain("391");
    expect(document.querySelector("[data-type='feat']")?.textContent).toContain("137");
    expect(document.querySelector("[data-type='rule']")?.textContent).toContain("70");
    expect(document.querySelector("[data-type='classes']")?.textContent).toContain("24");
    expect(document.querySelector("[data-type='equipment']")?.textContent).toContain("51");
    expect(document.querySelector("[data-type='origins']")?.textContent).toContain("13");
    expect(document.querySelector("[data-type='magic-item']")?.textContent).toContain("350");
    expect(document.querySelector("[data-type='monster']")?.textContent).toContain("330");
  });

  it("affiche les filtres minimaux des monstres et replie les options avancées", () => {
    mountPanel({ enabled: true, bilingual: true, defaultCategory: "monster" }, () => undefined);
    document.querySelector<HTMLButtonElement>("#dd55-launcher")!.click();
    expect(document.querySelector("[data-type='monster']")?.classList.contains("is-active")).toBe(true);
    expect(document.querySelector<HTMLElement>("[data-monster-filters]")!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("[data-monster-advanced]")!.hidden).toBe(true);
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("330");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
  });

  it("filtre les monstres par type, FP et critères avancés avec bornes cohérentes", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='monster']")!.click();
    const type = document.querySelector<HTMLSelectElement>("[data-monster-type]")!;
    const fpMin = document.querySelector<HTMLSelectElement>("[data-monster-fp-min]")!;
    const fpMax = document.querySelector<HTMLSelectElement>("[data-monster-fp-max]")!;
    type.value = "Aberration"; type.dispatchEvent(new Event("change"));
    fpMin.value = "10"; fpMin.dispatchEvent(new Event("change"));
    fpMax.value = "10"; fpMax.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-entry-id='monster-aboleth']")).not.toBeNull();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("1 référence");
    fpMax.value = "1"; fpMax.dispatchEvent(new Event("change"));
    expect(fpMin.value).toBe("1");

    document.querySelector<HTMLButtonElement>("[data-clear-monster-filters]")!.click();
    document.querySelector<HTMLButtonElement>("[data-monster-advanced-toggle]")!.click();
    const category = document.querySelector<HTMLSelectElement>("[data-monster-category]")!;
    const size = document.querySelector<HTMLSelectElement>("[data-monster-size]")!;
    category.value = "Animaux"; category.dispatchEvent(new Event("change"));
    size.value = "G"; size.dispatchEvent(new Event("change"));
    const count = Number(document.querySelector("[data-result-count]")?.textContent?.match(/\d+/)?.[0]);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(95);
    expect(document.querySelector("[data-monster-advanced-count]")?.textContent).toBe("2");

    const caMin = document.querySelector<HTMLInputElement>("[data-monster-ca-min]")!;
    const caMax = document.querySelector<HTMLInputElement>("[data-monster-ca-max]")!;
    caMin.value = "20"; caMin.dispatchEvent(new Event("input"));
    caMax.value = "10"; caMax.dispatchEvent(new Event("input"));
    expect(caMin.value).toBe("10");
    document.querySelector<HTMLButtonElement>("[data-clear-monster-filters]")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("330");
    expect(document.querySelector<HTMLElement>("[data-monster-advanced]")!.hidden).toBe(true);
  });

  it("affiche et copie un profil de monstre complet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='monster']")!.click();
    search("Aboleth");
    document.querySelector<HTMLButtonElement>("[data-entry-id='monster-aboleth']")!.click();
    expect(document.querySelector("[data-detail] h2")?.textContent).toBe("Aboleth");
    expect(document.querySelectorAll(".dd55-monster-abilities > div")).toHaveLength(6);
    expect(document.querySelector(".dd55-monster-combat")?.textContent).toContain("150 (20d10 + 40)");
    expect(document.querySelector(".dd55-monster-category")?.textContent).toContain("Créature légendaire");
    document.querySelector<HTMLButtonElement>("[data-copy-target='all']")!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("Caractéristiques : For 21 (+5), JS +5");
    expect(writeText.mock.calls[0][0]).toContain("Actions Légendaires");
  });

  it("affiche les boutons Roll20 uniquement sur les actions mécaniques", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='monster']")!.click();
    search("Aboleth");
    document.querySelector<HTMLButtonElement>("[data-entry-id='monster-aboleth']")!.click();
    const cards = [...document.querySelectorAll<HTMLElement>(".dd55-monster-action")];
    const multiattack = cards.find(card => card.querySelector("h4")?.textContent === "Attaques multiples")!;
    const tentacle = cards.find(card => card.querySelector("h4")?.textContent === "Tentacule")!;
    const legendaryReference = cards.find(card => card.querySelector("h4")?.textContent === "Coup de tentacule")!;
    expect(multiattack.querySelector("[data-monster-roll-action]")).toBeNull();
    expect(tentacle.querySelector("[data-monster-roll-action]")).not.toBeNull();
    expect(legendaryReference.querySelector("[data-monster-roll-action]")).not.toBeNull();
    expect(document.querySelector(".dd55-copyable-section h3")?.textContent).toBe("Traits");
  });

  it("préremplit le chat Roll20 sans envoyer la macro", () => {
    document.body.innerHTML = `<div id="textchat-input"><textarea></textarea><button id="send-chat">Envoyer</button></div>`;
    const sent = vi.fn();
    document.querySelector("#send-chat")!.addEventListener("click", sent);
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='monster']")!.click();
    search("Aboleth");
    document.querySelector<HTMLButtonElement>("[data-entry-id='monster-aboleth']")!.click();
    const action = [...document.querySelectorAll<HTMLElement>(".dd55-monster-action")].find(card => card.querySelector("h4")?.textContent === "Tentacule")!;
    action.querySelector<HTMLButtonElement>("[data-monster-roll-action]")!.click();
    const chat = document.querySelector<HTMLTextAreaElement>("#textchat-input textarea")!;
    expect(chat.value).toContain("/w gm &{template:default}");
    expect(chat.value).toContain("{{Attaque 1=[[1d20+9]]}}");
    expect(sent).not.toHaveBeenCalled();
    expect(document.querySelector("[data-copy-status]")?.textContent).toContain("n’a pas été envoyée");
  });

  it("envoie le jet quand l’option automatique est active", () => {
    document.body.innerHTML = `<div id="textchat-input"><textarea></textarea><button id="chatSendBtn" class="btn">Envoyer</button></div>`;
    const sent = vi.fn();
    document.querySelector("#chatSendBtn")!.addEventListener("click", sent);
    mountPanel({ enabled: true, bilingual: true, autoRollMonsterActions: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='monster']")!.click();
    search("Aboleth");
    document.querySelector<HTMLButtonElement>("[data-entry-id='monster-aboleth']")!.click();
    const action = [...document.querySelectorAll<HTMLElement>(".dd55-monster-action")].find(card => card.querySelector("h4")?.textContent === "Tentacule")!;
    action.querySelector<HTMLButtonElement>("[data-monster-roll-action]")!.click();
    expect(sent).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-copy-status]")?.textContent).toContain("Jet envoyé");
  });

  it("copie la macro sans écraser un brouillon Roll20", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    document.body.innerHTML = `<div id="textchat-input"><textarea>brouillon MJ</textarea></div>`;
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='monster']")!.click();
    search("Ankheg");
    document.querySelector<HTMLButtonElement>("[data-entry-id='monster-ankheg']")!.click();
    const action = [...document.querySelectorAll<HTMLElement>(".dd55-monster-action")].find(card => card.querySelector("h4")?.textContent?.startsWith("Aspersion acide"))!;
    action.querySelector<HTMLButtonElement>("[data-monster-roll-action]")!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(document.querySelector<HTMLTextAreaElement>("#textchat-input textarea")!.value).toBe("brouillon MJ");
    expect(writeText.mock.calls[0][0]).toContain("{{Sauvegarde=Dextérité DD 12}}");
    await vi.waitFor(() => expect(document.querySelector("[data-copy-status]")?.textContent).toContain("Macro Roll20 copiée"));
  });

  it("émet des préférences complètes quand les réglages changent", () => {
    const onChange = vi.fn();
    mountPanel({ enabled: true, bilingual: true }, onChange);
    const enabled = document.querySelector<HTMLInputElement>("[data-enabled]")!;
    const bilingual = document.querySelector<HTMLInputElement>("[data-bilingual]")!;
    enabled.checked = false;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith({ enabled: false, bilingual: true });
    bilingual.checked = false;
    bilingual.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith({ enabled: false, bilingual: false });
  });

  it("ouvre les réglages depuis l’écrou et applique les préférences visuelles", () => {
    const onChange = vi.fn();
    mountPanel({ enabled: true, bilingual: true }, onChange);
    const panel = document.querySelector<HTMLElement>("#dd55-companion")!;
    const settingsButton = document.querySelector<HTMLButtonElement>("[data-settings-open]")!;
    expect(settingsButton.nextElementSibling).toMatchObject({ dataset: expect.objectContaining({ expand: "" }) });
    settingsButton.click();
    expect(document.querySelector<HTMLElement>("[data-settings]")!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("[data-home]")!.hidden).toBe(true);

    const theme = document.querySelector<HTMLSelectElement>("[data-setting-theme]")!;
    theme.value = "dark";
    theme.dispatchEvent(new Event("change", { bubbles: true }));
    expect(panel.dataset.theme).toBe("dark");
    expect(onChange).toHaveBeenLastCalledWith({ theme: "dark" });

    const autoRoll = document.querySelector<HTMLInputElement>("[data-auto-roll-monsters]")!;
    expect(autoRoll.checked).toBe(false);
    autoRoll.checked = true;
    autoRoll.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith({ autoRollMonsterActions: true });

    document.querySelector<HTMLButtonElement>("[data-settings-back]")!.click();
    expect(document.querySelector<HTMLElement>("[data-home]")!.hidden).toBe(false);
    expect(document.activeElement).toBe(settingsButton);
  });

  it("restaure les préférences d’affichage et la catégorie initiale", () => {
    mountPanel({ enabled: true, bilingual: true, theme: "dark", fontSize: "large", resultDensity: "compact", defaultCategory: "spell", expandedByDefault: true }, () => undefined);
    const panel = document.querySelector<HTMLElement>("#dd55-companion")!;
    document.querySelector<HTMLButtonElement>("#dd55-launcher")!.click();
    expect(panel.dataset).toMatchObject({ theme: "dark", fontSize: "large", density: "compact" });
    expect(panel.classList.contains("is-expanded")).toBe(true);
    expect(document.querySelector("[data-type='spell']")?.classList.contains("is-active")).toBe(true);
    expect(document.querySelector<HTMLElement>("[data-spell-filters]")!.hidden).toBe(false);
  });

  it("réinitialise la position et permet de masquer le lanceur", () => {
    const onLauncherChange = vi.fn();
    mountPanel({ enabled: true, bilingual: true, launcherPosition: { left: 100, top: 80 }, panelPosition: { left: 60, top: 40 } }, () => undefined, onLauncherChange);
    document.querySelector<HTMLButtonElement>("[data-settings-open]")!.click();
    document.querySelector<HTMLButtonElement>("[data-reset-panel]")!.click();
    expect(document.querySelector<HTMLElement>("#dd55-companion")!.style.left).toBe("");
    expect(onLauncherChange).toHaveBeenCalledWith({ panelPosition: null });
    document.querySelector<HTMLButtonElement>("[data-reset-launcher]")!.click();
    const launcher = document.querySelector<HTMLButtonElement>("#dd55-launcher")!;
    expect(launcher.style.left).toBe("");
    expect(onLauncherChange).toHaveBeenCalledWith({ launcherPosition: null });
    const visible = document.querySelector<HTMLInputElement>("[data-launcher-visible]")!;
    visible.checked = false;
    visible.dispatchEvent(new Event("change", { bubbles: true }));
    expect(launcher.hidden).toBe(true);
  });

  it("affiche un état vide actionnable", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("requête introuvable xyz");
    expect(document.querySelector(".dd55-empty")?.textContent).toContain("Aucune fiche trouvée");
    document.querySelector<HTMLButtonElement>("[data-empty-clear-search]")!.click();
    expect(document.querySelector<HTMLInputElement>("[data-search]")!.value).toBe("");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
  });

  it("surligne une correspondance même sans accent dans la requête", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Epuisement");
    expect(document.querySelector("[data-entry-id='rule-etat-epuisement'] mark")?.textContent).toBe("Épuisement");
  });

  it("charge réellement les références suivantes dans l'onglet Tout", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("#dd55-launcher")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
    const before = document.querySelector("[data-load-more]")?.textContent;
    document.querySelector<HTMLButtonElement>("[data-load-more]")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(160);
    expect(document.querySelector("[data-load-more]")?.textContent).not.toBe(before);
  });

  it("parcourt les classes et ouvre une sous-classe", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    expect(document.querySelector<HTMLSelectElement>("[data-class-kind]")?.value).toBe("class");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(12);
    expect(document.querySelector("[data-entry-id='class-magicien']")).not.toBeNull();
    expect(document.querySelector("[data-results] [data-entry-id^='subclass-']")).toBeNull();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-magicien']")!.click();
    const subclassLink = document.querySelector<HTMLButtonElement>(".dd55-mastery-link [data-entry-id='subclass-evocateur']")!;
    expect(subclassLink).not.toBeNull();
    subclassLink.click();
    const detail = document.querySelector("[data-detail]")?.textContent ?? "";
    expect(detail).toContain("Sous-classe de Magicien");
    expect(detail).toContain("Évocateur érudit");
  });

  it("filtre les classes et sous-classes par type de fiche", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    const select = document.querySelector<HTMLSelectElement>("[data-class-kind]")!;
    select.value = "subclass";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(12);
    expect(document.querySelector("[data-results] [data-entry-id^='class-']")).toBeNull();
    expect(document.querySelector("[data-entry-id='subclass-evocateur']")).not.toBeNull();
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(24);
  });

  it("filtre les règles par type", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='rule']")!.click();
    const select = document.querySelector<HTMLSelectElement>("[data-rule-kind]")!;
    select.value = "État";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(15);
    expect(document.querySelector("[data-entry-id='rule-etat-aveugle']")).not.toBeNull();
    select.value = "Propriété d’arme";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(10);
    expect(document.querySelector("[data-entry-id='rule-propriete-arme-legere']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-clear-rule-filters]")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(70);
  });

  it("affiche la progression d’une classe comme un vrai tableau", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-barde']")!.click();
    const table = document.querySelector<HTMLTableElement>(".dd55-progression table")!;
    expect(table).not.toBeNull();
    expect(document.querySelectorAll(".dd55-start-card")).toHaveLength(2);
    expect(document.querySelector(".dd55-presentation")?.textContent).toContain("Personnage multiclassé");
    expect(document.querySelector(".dd55-progression-heading")?.textContent).toContain("Progression du Barde");
    expect(table.querySelectorAll("thead th")).toHaveLength(15);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(20);
    expect(table.querySelector("tbody tr")?.textContent).toContain("Inspiration bardique, Sorts");
  });

  it("affiche une vraie fiche de sort structurée", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Boule de feu");
    document.querySelector<HTMLButtonElement>("[data-entry-id='spell-boule-de-feu']")!.click();
    const detail = document.querySelector("[data-detail]")?.textContent ?? "";
    expect(detail).toContain("Sort de niveau 3");
    expect(detail).toContain("Évocation");
    expect(detail).toContain("Portée");
    expect(detail).toContain("45 m");
    expect(detail).toContain("8d6 dégâts de feu");
  });

  it("copie un bloc de texte propre et confirme la copie", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Boule de feu");
    document.querySelector<HTMLButtonElement>("[data-entry-id='spell-boule-de-feu']")!.click();
    const button = document.querySelector<HTMLButtonElement>("[data-copy-target='section-0']")!;
    button.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("8d6 dégâts de feu");
    expect(copied).not.toContain("Copier");
    expect(copied).not.toContain("À découvrir aussi");
    await vi.waitFor(() => expect(button.textContent).toContain("✓ Copié"));
    expect(document.querySelector("[data-copy-status]")?.textContent).toContain("Contenu copié");
  });

  it("copie la fiche complète dans l’ordre avec ses métadonnées et sa source", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Boule de feu");
    document.querySelector<HTMLButtonElement>("[data-entry-id='spell-boule-de-feu']")!.click();
    document.querySelector<HTMLButtonElement>("[data-copy-target='all']")!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied.startsWith("Boule de feu\n")).toBe(true);
    expect(copied).toContain("Niveau : 3");
    expect(copied.indexOf("8d6 dégâts de feu")).toBeLessThan(copied.indexOf("Source : SRD 5.2.1 FR"));
    expect(copied).not.toContain("Page SRD");
    expect(copied).not.toContain("À découvrir aussi");
  });

  it("copie les présentations et les tableaux avec des retours et tabulations", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-barde']")!.click();
    document.querySelector<HTMLButtonElement>("[data-copy-target='presentation']")!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("Présentation\n");
    document.querySelector<HTMLButtonElement>("[data-copy-target='table-0']")!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    const copiedTable = writeText.mock.calls[1][0] as string;
    expect(copiedTable).toContain("Niveau\tBM\tAptitudes de classe");
    expect(copiedTable.split("\n").length).toBeGreaterThanOrEqual(22);
  });

  it("utilise la copie de repli puis signale un échec total", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("refusé"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const execCommand = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Boule de feu");
    document.querySelector<HTMLButtonElement>("[data-entry-id='spell-boule-de-feu']")!.click();
    const sectionButton = document.querySelector<HTMLButtonElement>("[data-copy-target='section-0']")!;
    sectionButton.click();
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledTimes(1));
    expect(sectionButton.textContent).toContain("✓ Copié");
    expect(document.querySelector("textarea")).toBeNull();
    const allButton = document.querySelector<HTMLButtonElement>("[data-copy-target='all']")!;
    allButton.click();
    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledTimes(2));
    expect(allButton.textContent).toContain("Copie impossible");
    expect(document.querySelector("[data-copy-status]")?.textContent).toContain("échoué");
  });

  it("transforme la table textuelle des actions en lignes lisibles", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Actions");
    document.querySelector<HTMLButtonElement>("[data-entry-id='rule-actions']")!.click();
    expect(document.querySelectorAll(".dd55-action-item")).toHaveLength(12);
    expect(document.querySelector(".dd55-action-item dt")?.textContent).toBe("Attaque");
    expect(document.querySelector(".dd55-prose h4")?.textContent).toBe("Une chose à la fois");
  });

  it("sépare les paragraphes, encarts et listes des aptitudes de classe", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='class-barbare']")!.click();
    expect(document.querySelectorAll(".dd55-rule-point").length).toBeGreaterThan(3);
    expect(document.querySelectorAll(".dd55-bullets li").length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector(".dd55-rule-point")?.textContent).toContain("Résistance aux dégâts");
  });

  it("résout les variantes françaises vers le titre du SRD", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Éclair traçant");
    expect(document.querySelector("[data-entry-id='spell-rayon-tracant']")).not.toBeNull();
    expect(document.querySelector("a[href*='eclair-tracant']")).toBeNull();
  });

  it("propose AideDD uniquement pour une référence absente du SRD", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Chanceux");
    expect(document.querySelector("[data-external-url*='/feat/fr/chanceux']")).not.toBeNull();
  });

  it("affiche les 137 dons locaux et externes dans la catégorie Dons", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='feat']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("137");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
    expect(document.querySelector("[data-load-more]")?.textContent).toContain("57 restantes");
  });

  it("conserve les libellés complets dans les onglets et panneaux de filtres", () => {
    mountPanel({ enabled: true, bilingual: true, theme: "dark" }, () => undefined);
    expect(document.querySelector("[data-type='magic-item']")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Objets magiques 350");
    document.querySelector<HTMLButtonElement>("[data-type='classes']")!.click();
    expect(document.querySelector("[data-class-filters] > div:first-child")?.textContent).toContain("Filtrer les classes");
    expect(document.querySelector("[data-class-filters] label > span")?.textContent).toBe("Type de fiche");
    expect(document.querySelector<HTMLSelectElement>("[data-class-kind]")?.selectedOptions[0].textContent).toBe("Classes seulement");
    document.querySelector<HTMLButtonElement>("[data-type='feat']")!.click();
    expect(document.querySelector("[data-feat-filters] > div:first-child")?.textContent).toContain("Filtrer les dons");
    expect([...document.querySelectorAll("[data-feat-filters] label > span")].map(label => label.textContent)).toEqual(["Type de don", "Source"]);
    expect(document.querySelector<HTMLSelectElement>("[data-feat-category]")?.selectedOptions[0].textContent).toBe("Tous les types");
    expect(document.querySelector<HTMLSelectElement>("[data-feat-source]")?.selectedOptions[0].textContent).toBe("Toutes les sources");
  });

  it("filtre les dons par type et par source", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='feat']")!.click();
    const category = document.querySelector<HTMLSelectElement>("[data-feat-category]")!;
    const source = document.querySelector<HTMLSelectElement>("[data-feat-source]")!;

    category.value = "dragonmark";
    category.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("13");
    expect(document.querySelector("[data-results] .dd55-entry-card small")?.textContent).toContain("Don de dracogramme");

    source.value = "Eberron: Forge of the Artificer";
    source.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("13");

    category.value = "epic-boon";
    category.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("1 référence");

    category.value = "origin";
    category.dispatchEvent(new Event("change"));
    source.value = "Player's Handbook 2024";
    source.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-entry-id='feat-vigilant']")).not.toBeNull();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("10");

    document.querySelector<HTMLButtonElement>("[data-clear-feat-filters]")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("137");
  });

  it("affiche les 391 sorts locaux et externes dans la catégorie Sorts", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='spell']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("391");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
    expect(document.querySelector("[data-load-more]")?.textContent).toContain("311 restantes");
  });

  it("filtre et trie les objets magiques locaux et externes par rareté", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='magic-item']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("350");
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(80);
    expect(document.querySelector("[data-load-more]")?.textContent).toContain("270 restantes");
    document.querySelector<HTMLButtonElement>("[data-magic-rarity='Artefact']")!.click();
    document.querySelector<HTMLButtonElement>("[data-magic-rarity='Courant']")!.click();
    const cards = [...document.querySelectorAll<HTMLElement>("[data-results] .dd55-entry-card")];
    expect(cards.length).toBeGreaterThan(0);
    const sort = document.querySelector<HTMLSelectElement>("[data-magic-item-sort]")!;
    sort.value = "rarity-asc";
    sort.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-results] .dd55-entry-card small")?.textContent?.toLocaleLowerCase("fr")).toContain("courant");
    sort.value = "rarity-desc";
    sort.dispatchEvent(new Event("change"));
    expect(document.querySelector("[data-results] .dd55-entry-card small")?.textContent?.toLocaleLowerCase("fr")).toContain("artefact");
    document.querySelector<HTMLButtonElement>("[data-clear-magic-item-filters]")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("350");
  });

  it("ouvre une fiche magique locale et une référence AideDD externe", () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='magic-item']")!.click();
    search("Amulette d’antidétection");
    document.querySelector<HTMLButtonElement>("[data-entry-id='magic-item-amulette-d-antidetection']")!.click();
    expect(document.querySelector("[data-detail] h2")?.textContent).toBe("Amulette d’antidétection");
    expect(document.querySelector("[data-detail] [data-copy-target='all']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-back]")!.click();
    search("Dark Shard Amulet");
    document.querySelector<HTMLButtonElement>("[data-external-url$='/magic-item/fr/amulette-de-sombre-eclat']")!.click();
    expect(sendMessage).toHaveBeenCalledWith({ type: "DD55_OPEN_EXTERNAL", url: "https://www.aidedd.org/magic-item/fr/amulette-de-sombre-eclat" });
  });

  it("retrouve un sort externe en anglais avec son lien AideDD français", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Armor of Agathys");
    const button = document.querySelector<HTMLButtonElement>("[data-external-url$='/spell/fr/armure-d-agathys']");
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Armure d'Agathys");
    expect(button?.textContent).toContain("niveau 1");
  });

  it("retrouve un don enrichi en anglais avec son lien AideDD français", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Telekinetic");
    const link = document.querySelector<HTMLButtonElement>("[data-external-url*='/feat/fr/telekinesiste']");
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain("Télékinésiste");
  });

  it("ouvre AideDD via l'extension sans exposer de lien interceptable par Roll20", () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    search("Crossbow Expert");
    const button = document.querySelector<HTMLButtonElement>("[data-external-url*='/feat/fr/maitre-arbaletrier']")!;
    expect(button.tagName).toBe("BUTTON");
    button.click();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "DD55_OPEN_EXTERNAL",
      url: "https://www.aidedd.org/feat/fr/maitre-arbaletrier"
    });
  });

  it("filtre les sorts simultanément par classe et par niveau", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='spell']")!.click();
    const filters = document.querySelector<HTMLElement>("[data-spell-filters]")!;
    expect(filters.hidden).toBe(false);
    const classSelect = document.querySelector<HTMLSelectElement>("[data-spell-class]")!;
    const levelSelect = document.querySelector<HTMLSelectElement>("[data-spell-level]")!;
    classSelect.value = "Magicien";
    classSelect.dispatchEvent(new Event("change"));
    levelSelect.value = "3";
    levelSelect.dispatchEvent(new Event("change"));
    const ids = [...document.querySelectorAll<HTMLElement>("[data-results] [data-entry-id]")].map(element => element.dataset.entryId);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const entry = compendiumEntries.find(item => item.id === id)!;
      expect(entry.tags).toContain("Magicien");
      expect(entry.meta.Niveau).toBe("3");
    }
    expect(document.querySelector("[data-results] .dd55-external")).toBeNull();
  });

  it("filtre l’équipement par type et maîtrise d’arme", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='equipment']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("51");
    const typeSelect = document.querySelector<HTMLSelectElement>("[data-equipment-type]")!;
    const masterySelect = document.querySelector<HTMLSelectElement>("[data-weapon-mastery]")!;
    typeSelect.value = "Arme de guerre à distance";
    typeSelect.dispatchEvent(new Event("change"));
    masterySelect.value = "Ouverture";
    masterySelect.dispatchEvent(new Event("change"));
    const ids = [...document.querySelectorAll<HTMLElement>("[data-results] [data-entry-id]")].map(element => element.dataset.entryId);
    expect(ids).toHaveLength(3);
    for (const id of ids) {
      const entry = compendiumEntries.find(item => item.id === id)!;
      expect(entry.meta["Type d’équipement"]).toBe("Arme de guerre à distance");
      expect(entry.meta["Botte d’arme"]).toBe("Ouverture");
    }
  });

  it("relie une arme à la règle de sa botte d’arme", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='equipment']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='equipment-weapon-pistolet']")!.click();
    expect(document.querySelector("[data-detail]")?.textContent).toContain("1d10 perforants");
    const masteryLink = document.querySelector<HTMLButtonElement>(".dd55-mastery-link [data-entry-id='rule-botte-ouverture']")!;
    expect(masteryLink).not.toBeNull();
    masteryLink.click();
    expect(document.querySelector("[data-detail] h2")?.textContent).toBe("Ouverture");
    expect(document.querySelector("[data-detail]")?.textContent).toContain("Page SRD 96");
  });

  it("parcourt les origines et ouvre le don accordé par un historique", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='origins']")!.click();
    expect(document.querySelector("[data-result-count]")?.textContent).toContain("13");
    expect(document.querySelector("[data-entry-id='species-drakeide']")).not.toBeNull();
    document.querySelector<HTMLButtonElement>("[data-entry-id='background-criminel']")!.click();
    expect(document.querySelector("[data-detail]")?.textContent).toContain("Discrétion et Escamotage");
    const featLink = document.querySelector<HTMLButtonElement>(".dd55-mastery-link [data-entry-id='feat-vigilant']")!;
    expect(featLink).not.toBeNull();
    featLink.click();
    expect(document.querySelector("[data-detail] h2")?.textContent).toBe("Vigilant");
  });

  it("affiche les lignages d’une espèce dans un tableau d’options", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='origins']")!.click();
    document.querySelector<HTMLButtonElement>("[data-entry-id='species-elfe']")!.click();
    const options = document.querySelector<HTMLElement>(".dd55-options-table")!;
    expect(options).not.toBeNull();
    expect(options.textContent).toContain("Lignages elfiques");
    expect(options.textContent).toContain("Drow");
    expect(options.textContent).toContain("Haut-elfe");
    expect(options.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(options.textContent).not.toContain("Progression du Elfe");
    expect(options.querySelector(".dd55-progression-heading > span")).toBeNull();
  });

  it("filtre les origines entre espèces et historiques", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    document.querySelector<HTMLButtonElement>("[data-type='origins']")!.click();
    const filters = document.querySelector<HTMLElement>("[data-origin-filters]")!;
    const select = document.querySelector<HTMLSelectElement>("[data-origin-kind]")!;
    expect(filters.hidden).toBe(false);
    select.value = "species";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(9);
    expect(document.querySelector("[data-results] [data-entry-id^='background-']")).toBeNull();
    select.value = "background";
    select.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(4);
    expect(document.querySelector("[data-results] [data-entry-id^='species-']")).toBeNull();
    document.querySelector<HTMLButtonElement>("[data-clear-origin-filters]")!.click();
    expect(document.querySelectorAll("[data-results] .dd55-entry-card")).toHaveLength(13);
  });

  it("agrandit et réduit le compendium sans perdre son état", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    const panel = document.querySelector<HTMLElement>("#dd55-companion")!;
    const expand = document.querySelector<HTMLButtonElement>("[data-expand]")!;
    const search = document.querySelector<HTMLInputElement>("[data-search]")!;
    search.value = "rage";
    search.dispatchEvent(new Event("input"));

    expand.click();
    expect(panel.classList.contains("is-expanded")).toBe(true);
    expect(expand.getAttribute("aria-pressed")).toBe("true");
    expect(expand.getAttribute("aria-label")).toBe("Réduire le compendium");
    expect(search.value).toBe("rage");

    expand.click();
    expect(panel.classList.contains("is-expanded")).toBe(false);
    expect(expand.getAttribute("aria-pressed")).toBe("false");
    expect(expand.getAttribute("aria-label")).toBe("Agrandir le compendium");
    expect(search.value).toBe("rage");
  });
});
