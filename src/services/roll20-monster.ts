import type { CompendiumEntry, MonsterAction, MonsterData } from "./srd-compendium";

function sanitizeTemplateText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\{\{/g, "｛｛")
    .replace(/\}\}/g, "｝｝")
    .replace(/\[\[/g, "［［")
    .replace(/\]\]/g, "］］")
    .trim();
}

function compactDescription(value: string, maximum = 700): string {
  const normalized = sanitizeTemplateText(value);
  if (normalized.length <= maximum) return normalized;
  const shortened = normalized.slice(0, maximum - 1);
  const sentenceEnd = Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("; "));
  return `${(sentenceEnd > maximum * .55 ? shortened.slice(0, sentenceEnd + 1) : shortened).trim()}…`;
}

function normalizeFormula(value: string): string {
  return value
    .replace(/[−–]/g, "-")
    .replace(/[×x]/gi, "*")
    .replace(/\s+/g, "")
    .replace(/[^0-9dD+*/().-]/g, "");
}

export function resolveMonsterAction(monster: MonsterData, action: MonsterAction): MonsterAction | undefined {
  if (action.attack || action.saves.length || action.rolls.length) return action;
  if (!action.referenceActionId) return undefined;
  const referenced = monster.actions.find(candidate => candidate.id === action.referenceActionId);
  if (!referenced || referenced === action) return undefined;
  return referenced.attack || referenced.saves.length || referenced.rolls.length ? referenced : undefined;
}

export function isMonsterActionRollable(monster: MonsterData, action: MonsterAction): boolean {
  return Boolean(resolveMonsterAction(monster, action));
}

export type MonsterAttackRollMode = "two" | "single" | "advantage" | "disadvantage";

export function buildMonsterRollCommand(entry: CompendiumEntry, action: MonsterAction, attackRollMode: MonsterAttackRollMode = "two"): string | undefined {
  if (!entry.monster) return undefined;
  const mechanics = resolveMonsterAction(entry.monster, action);
  if (!mechanics) return undefined;
  const fields: string[] = [`{{name=${sanitizeTemplateText(`${entry.title} — ${action.name}`)}}}`];

  if (mechanics.attack) {
    const bonus = mechanics.attack.bonus >= 0 ? `+${mechanics.attack.bonus}` : String(mechanics.attack.bonus);
    if (attackRollMode === "two") fields.push(`{{Attaque 1=[[1d20${bonus}]]}}`, `{{Attaque 2=[[1d20${bonus}]]}}`);
    else if (attackRollMode === "advantage") fields.push(`{{Attaque avec Avantage=[[2d20kh1${bonus}]]}}`);
    else if (attackRollMode === "disadvantage") fields.push(`{{Attaque avec Désavantage=[[2d20kl1${bonus}]]}}`);
    else fields.push(`{{Attaque=[[1d20${bonus}]]}}`);
    if (mechanics.attack.range) fields.push(`{{Portée=${sanitizeTemplateText(mechanics.attack.range)}}}`);
  }

  mechanics.saves.forEach((save, index) => {
    const label = mechanics.saves.length > 1 ? `Sauvegarde ${index + 1}` : "Sauvegarde";
    fields.push(`{{${label}=${save.ability} DD ${save.dc}}}`);
  });

  const labels = new Map<string, number>();
  mechanics.rolls.forEach(roll => {
    const baseLabel = roll.kind === "healing" ? "Soins" : `Dégâts${roll.damageType ? ` ${roll.damageType}` : ""}`;
    const occurrence = (labels.get(baseLabel) ?? 0) + 1;
    labels.set(baseLabel, occurrence);
    const label = occurrence > 1 ? `${baseLabel} ${occurrence}` : baseLabel;
    fields.push(`{{${sanitizeTemplateText(label)}=[[${normalizeFormula(roll.formula)}]]}}`);
  });

  const description = action === mechanics
    ? action.description
    : `${action.description} Action associée : ${mechanics.name}. ${mechanics.description}`;
  fields.push(`{{Effet=${compactDescription(description)}}}`);
  return `/w gm &{template:default} ${fields.join(" ")}`;
}

function isVisible(element: HTMLElement, documentRoot: Document): boolean {
  if (element.closest("[hidden], [aria-hidden='true']")) return false;
  const view = documentRoot.defaultView;
  if (!view) return true;
  let current: HTMLElement | null = element;
  while (current) {
    const style = view.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

export function prefillRoll20Chat(command: string, documentRoot: Document = document): boolean {
  const input = documentRoot.querySelector<HTMLTextAreaElement>("#textchat-input textarea");
  if (!input || input.disabled || input.readOnly || input.value.length > 0 || !isVisible(input, documentRoot)) return false;
  const view = documentRoot.defaultView;
  const setter = view && Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) setter.call(input, command); else input.value = command;
  input.dispatchEvent(new (view?.Event ?? Event)("input", { bubbles: true }));
  input.focus();
  return input.value === command;
}

export type Roll20ChatResult = "sent" | "prefilled" | "unavailable";

export function prepareRoll20Chat(command: string, autoSend = false, documentRoot: Document = document): Roll20ChatResult {
  if (!prefillRoll20Chat(command, documentRoot)) return "unavailable";
  if (!autoSend) return "prefilled";

  const sendButton = documentRoot.querySelector<HTMLButtonElement>("#textchat-input #chatSendBtn");
  if (!sendButton || sendButton.disabled || !isVisible(sendButton, documentRoot)) return "prefilled";
  try {
    sendButton.click();
    return "sent";
  } catch {
    return "prefilled";
  }
}
