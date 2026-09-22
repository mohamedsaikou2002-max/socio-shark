// providers/registry.ts
// The ONE definition of which integrations exist and which secret keys each
// needs. Shared by the Settings UI (renders the fields) and the server (knows
// which provider owns a key when it is saved, so it can verify it immediately).
//
// Adding a platform = add an entry here + a provider module with a testAuth().
// The Settings field and save-time verification then appear automatically.
// Nothing here may import server-only code — it is imported by the browser.

export type ProviderId = "kling" | "meta" | "tiktok" | "anthropic";

export interface SecretKeyDef {
  /** `app_secrets` row key and `process.env` name — identical by design. */
  key: string;
  label: string;
  hint: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  /** What this integration is for. */
  hint: string;
  /** Per-provider "Test" button text. */
  testLabel: string;
  keys: SecretKeyDef[];
}

/** Normalised result of a provider's testAuth() check. */
export interface ProviderTestResult {
  providerId: string;
  ok: boolean;
  message: string;
  /** HTTP status when a request was actually made (0 = never left the server). */
  status?: number;
  /** Optional diagnostics, e.g. masked key preview. */
  detail?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "kling",
    label: "Kling",
    hint: "AI video generation (image → video). Used by single runs and the batch pipeline.",
    testLabel: "Test Kling keys",
    keys: [
      { key: "KLING_ACCESS_KEY", label: "Kling Access Key", hint: "AK — becomes the JWT `iss` claim" },
      { key: "KLING_SECRET_KEY", label: "Kling Secret Key", hint: "SK — HMAC secret the JWT is signed with" },
    ],
  },
  {
    id: "meta",
    label: "Instagram (Meta Graph)",
    hint: "Publishes Reels through the Meta Graph API.",
    testLabel: "Test Instagram keys",
    keys: [
      { key: "META_ACCESS_TOKEN", label: "Meta Access Token", hint: "Long-lived System User / Business token" },
      { key: "INSTAGRAM_ACCOUNT_ID", label: "Instagram Account ID", hint: "IG Professional account id" },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Content Posting API — direct video upload.",
    testLabel: "Test TikTok key",
    keys: [
      { key: "TIKTOK_ACCESS_TOKEN", label: "TikTok Access Token", hint: "TikTok Content Posting API token" },
    ],
  },
  {
    id: "anthropic",
    label: "Claude (captions)",
    hint: "Anthropic API — writes captions and pipeline prompts.",
    testLabel: "Test Claude key",
    keys: [
      { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key", hint: "Used for caption + prompt generation" },
    ],
  },
];

/** All secret keys, flattened, tagged with the provider that owns them. */
export function allSecretKeys(): (SecretKeyDef & { providerId: ProviderId })[] {
  return PROVIDERS.flatMap((p) => p.keys.map((k) => ({ ...k, providerId: p.id })));
}

export function providerById(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Which provider a given secret key belongs to (used on save for validation). */
export function providerByKey(key: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.keys.some((k) => k.key === key));
}
