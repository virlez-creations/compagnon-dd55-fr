export interface Reference {
  id: string;
  nameEn: string;
  nameFr: string;
  slug: string;
  aliases?: string[];
  compendiumId?: string;
  level?: number;
  category?: string;
  source?: string;
}

export type MagicItemRarity = "Courant" | "Peu courant" | "Rare" | "Très rare" | "Légendaire" | "Artefact" | "Variable";

export interface MagicItemReference extends Reference {
  itemType: string;
  rarities: MagicItemRarity[];
  rarity: string;
  source: string;
}

export interface Preferences {
  enabled: boolean;
  bilingual: boolean;
  theme?: "light" | "dark";
  fontSize?: "small" | "normal" | "large";
  resultDensity?: "comfortable" | "compact";
  defaultCategory?: "" | "rule" | "classes" | "origins" | "equipment" | "spell" | "feat" | "magic-item" | "monster";
  expandedByDefault?: boolean;
  launcherVisible?: boolean;
  launcherPosition?: { left: number; top: number } | null;
  panelPosition?: { left: number; top: number } | null;
}
