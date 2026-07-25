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

export interface Preferences {
  enabled: boolean;
  bilingual: boolean;
}
