// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mountPanel } from "../src/content/panel";

describe("panneau SRD local", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("recherche et ouvre une page du SRD sans lien externe", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    const input = document.querySelector<HTMLInputElement>("[data-search]")!;
    input.value = "Test d20";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const result = document.querySelector<HTMLButtonElement>("[data-srd-page]");
    expect(result).not.toBeNull();
    result!.click();
    expect(document.querySelector("[data-srd-detail]")?.textContent).toContain("SRD 5.2.1");
    expect(document.querySelector("[data-srd-detail]")?.textContent).toContain("Test d20");
  });

  it("ouvre un sort du SRD localement et réserve AideDD aux absents", () => {
    mountPanel({ enabled: true, bilingual: true }, () => undefined);
    const input = document.querySelector<HTMLInputElement>("[data-search]")!;
    input.value = "Éclair traçant";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("[data-results] [data-srd-label='Éclair traçant']")).not.toBeNull();
    expect(document.querySelector("[data-results] a[href*='eclair-tracant']")).toBeNull();
    input.value = "Chanceux";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector("[data-results] a[href*='/feat/fr/chanceux']")).not.toBeNull();
  });
});
