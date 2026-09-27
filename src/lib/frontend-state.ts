export type SocialPlatform = "instagram" | "tiktok";

export interface LocalSocialAccount {
  id: string;
  platform: SocialPlatform;
  label: string;
  status: "connected" | "expired";
}

export interface LocalIndustryProfile {
  id: string;
  name: string;
  toneNotes: string;
  examples: string[];
}

export const SOCIAL_ACCOUNTS_KEY = "socio_social_accounts";
export const INDUSTRY_PROFILES_KEY = "socio_industry_profiles";

export function readLocalList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("socio-local-state", { detail: { key } }));
}
