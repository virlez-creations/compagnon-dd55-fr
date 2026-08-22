// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMonsterRollCommand, isMonsterActionRollable, prefillRoll20Chat, prepareRoll20Chat } from "../src/services/roll20-monster";
import { compendiumEntries, findCompendiumEntry } from "../src/services/srd-compendium";

describe("macros Roll20 des monstres", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("génère une carte privée avec deux d20, la portée et tous les dégâts", () => {
    const assassin = findCompendiumEntry("Assassin", "monster")!;
    const shortSword = assassin.monster!.actions.find(action => action.name === "Épée courte")!;
    const command = buildMonsterRollCommand(assassin, shortSword)!;
    expect(command).toBe("/w gm &{template:default} {{name=Assassin — Épée courte}} {{Attaque 1=[[1d20+7]]}} {{Attaque 2=[[1d20+7]]}} {{Portée=Allonge 1,50 m}} {{Dégâts perforants=[[1d6+4]]}} {{Dégâts poison=[[5d6]]}} {{Effet=Corps à corps : +7 , allonge 1,50 m. Touché : 7 (1d6 + 4) dégâts perforants plus 17 (5d6) dégâts de poison, et la cible subit l’état Empoisonné jusqu’au début du tour suivant de l’assassin.}}");
  });

  it("génère les sauvegardes, les soins et les références d’action", () => {
    const aboleth = findCompendiumEntry("Aboleth", "monster")!;
    const memory = aboleth.monster!.actions.find(action => action.name === "Assimilation de mémoire")!;
    expect(buildMonsterRollCommand(aboleth, memory)).toContain("{{Sauvegarde=Intelligence DD 16}} {{Dégâts psychiques=[[3d6]]}}");
    const healing = aboleth.monster!.actions.find(action => action.name === "Succion psychique")!;
    expect(buildMonsterRollCommand(aboleth, healing)).toContain("{{Soins=[[1d10]]}}");
    const reference = aboleth.monster!.actions.find(action => action.name === "Coup de tentacule")!;
    expect(isMonsterActionRollable(aboleth.monster!, reference)).toBe(true);
    expect(buildMonsterRollCommand(aboleth, reference)).toContain("{{Attaque 1=[[1d20+9]]}}");
  });

  it("gère les bonus négatifs, les dégâts fixes et neutralise les délimiteurs", () => {
    const entry = findCompendiumEntry("Aboleth", "monster")!;
    const sourceAction = entry.monster!.actions.find(candidate => candidate.name === "Tentacule")!;
    const action = { ...sourceAction, attack: { ...sourceAction.attack!, bonus: -2 } };
    expect(buildMonsterRollCommand(entry, action)).toContain("Attaque 1=[[1d20-2]]");
    const fixedEntry = compendiumEntries.find(candidate => candidate.monster?.actions.some(candidateAction => candidateAction.rolls.some(roll => /^\d+$/.test(roll.formula))))!;
    const fixedAction = fixedEntry.monster!.actions.find(candidate => candidate.rolls.some(roll => /^\d+$/.test(roll.formula)))!;
    expect(buildMonsterRollCommand(fixedEntry, fixedAction)).toMatch(/Dégâts[^=]*=\[\[\d+\]\]/);
    const unsafe = { ...action, name: "Test {{cassé}}", description: "Effet [[injecté]] et }} fin" };
    const sanitized = buildMonsterRollCommand(entry, unsafe)!;
    expect(sanitized).not.toContain("{{cassé}}");
    expect(sanitized).not.toContain("[[injecté]]");
    expect(sanitized).toContain("Test ｛｛cassé｝｝");
  });

  it("préremplit uniquement un chat Roll20 visible, vide et actif sans envoyer", () => {
    document.body.innerHTML = `<div id="textchat-input"><textarea></textarea><button id="send">Envoyer</button></div>`;
    const input = document.querySelector<HTMLTextAreaElement>("textarea")!;
    const inputEvent = vi.fn();
    const send = vi.fn();
    input.addEventListener("input", inputEvent);
    document.querySelector("#send")!.addEventListener("click", send);
    expect(prefillRoll20Chat("/w gm test")).toBe(true);
    expect(input.value).toBe("/w gm test");
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it("préserve les brouillons et refuse un chat masqué ou absent", () => {
    document.body.innerHTML = `<div id="textchat-input"><textarea>brouillon</textarea></div>`;
    expect(prefillRoll20Chat("macro")).toBe(false);
    expect(document.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("brouillon");
    document.body.innerHTML = `<div id="textchat-input" hidden><textarea></textarea></div>`;
    expect(prefillRoll20Chat("macro")).toBe(false);
    document.body.innerHTML = "";
    expect(prefillRoll20Chat("macro")).toBe(false);
  });

  it("envoie par le bouton Roll20 ciblé uniquement quand l’option est active", () => {
    document.body.innerHTML = `<div id="textchat-input"><textarea></textarea><button id="chatSendBtn" class="btn">Envoyer</button></div>`;
    const send = vi.fn();
    document.querySelector("#chatSendBtn")!.addEventListener("click", send);

    expect(prepareRoll20Chat("/w gm test", false)).toBe("prefilled");
    expect(send).not.toHaveBeenCalled();

    document.querySelector<HTMLTextAreaElement>("textarea")!.value = "";
    expect(prepareRoll20Chat("/w gm test", true)).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
  });

  it("n’envoie pas si le bouton ciblé est absent et ne remplace jamais un brouillon", () => {
    document.body.innerHTML = `<div id="textchat-input"><textarea></textarea><button id="autre-bouton">Envoyer</button></div>`;
    expect(prepareRoll20Chat("macro", true)).toBe("prefilled");
    expect(document.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("macro");

    document.body.innerHTML = `<div id="textchat-input"><textarea>brouillon MJ</textarea><button id="chatSendBtn">Envoyer</button></div>`;
    expect(prepareRoll20Chat("macro", true)).toBe("unavailable");
    expect(document.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("brouillon MJ");
  });
});
