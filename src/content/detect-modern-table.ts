const MODERN_SHEET_ID = "dnd2024byroll20";

type Roll20Model = {
  get?: (key: string) => unknown;
  models?: Roll20Model[];
  characters?: Roll20Model;
};

function modelValues(model: Roll20Model | undefined): string[] {
  if (!model) return [];
  const keys = ["charactersheetname", "charactersheet", "character_sheet", "default_character_sheet", "charsheettype", "sheettype", "sheet_type", "sheet", "defaultsheet"];
  const values = keys.map(key => model.get?.(key)).filter((value): value is string => typeof value === "string");
  const characters = model.characters?.models ?? [];
  for (const character of characters) values.push(...keys.map(key => character.get?.(key)).filter((value): value is string => typeof value === "string"));
  return values;
}

function detectModernTable(): boolean {
  const roll20 = globalThis as typeof globalThis & { Campaign?: Roll20Model; d20?: { Campaign?: Roll20Model; campaign?: Roll20Model } };
  const models = [roll20.Campaign, roll20.d20?.Campaign, roll20.d20?.campaign];
  const values = models.flatMap(modelValues).map(value => value.toLocaleLowerCase("en"));
  const domMarker = document.querySelector(`[data-sheet-type*="${MODERN_SHEET_ID}" i], [data-character-sheet*="${MODERN_SHEET_ID}" i], [src*="${MODERN_SHEET_ID}" i], [href*="${MODERN_SHEET_ID}" i]`);
  return values.some(value => value.includes(MODERN_SHEET_ID)) || Boolean(domMarker);
}

function publishDetection(): void {
  if (!document.documentElement || document.documentElement.dataset.dd55ModernDnd5 === "true" || !detectModernTable()) return;
  document.documentElement.dataset.dd55ModernDnd5 = "true";
  document.dispatchEvent(new CustomEvent("dd55:modern-table"));
}

publishDetection();
const detectionTimer = window.setInterval(publishDetection, 1000);
window.setTimeout(() => window.clearInterval(detectionTimer), 120000);
