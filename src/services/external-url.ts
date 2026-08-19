export function isAllowedExternalUrl(url: string): boolean {
  return /^https:\/\/www\.aidedd\.org\/(?:feat|spell|magic-item)\/fr\/[a-z0-9-]+$/.test(url);
}
