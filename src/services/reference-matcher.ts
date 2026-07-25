import type { Reference } from "../types";

export function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/g, "")
    .replace(/\s*\(2024\)\s*/gi, "").replace(/\s*\[.*?]\s*/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

export function findReference(value: string, references: Reference[]): Reference | undefined {
  const wanted = normalizeName(value);
  return references.find((item) => [item.nameEn, item.nameFr, ...(item.aliases ?? [])].some((name) => normalizeName(name) === wanted));
}

export function referenceUrl(kind: "spell" | "feat", item: Reference): string {
  return `https://www.aidedd.org/${kind}/fr/${item.slug}`;
}
