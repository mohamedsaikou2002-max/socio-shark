// secrets.core.ts
// Single source of truth for reading API keys on the server.
//
// Resolution order: process.env first (Cloudflare Worker bindings / .env),
// then the `app_secrets` table (values pasted into Settings → API Tokens).
//
// Every server function that needs an API key must go through these helpers —
// no direct `process.env.SOME_KEY` reads in provider code, otherwise the
// Settings UI and provider configuration can drift apart.
//
// This module is import-safe from both server functions and other server-only
// modules; it must never be imported by a client component.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Read a secret: env var first, `app_secrets` table as fallback. */
export async function getSecret(key: string): Promise<string | null> {
  const envVal = process.env[key];
  if (envVal) return envVal;

  const { data } = await supabaseAdmin
    .from("app_secrets")
    .select("value")
    .eq("key", key)
    .single();

  return data?.value ?? null;
}

/** Same as getSecret, but trims stray quotes/whitespace and throws when missing. */
export async function requireSecret(key: string): Promise<string> {
  const value = (await getSecret(key))?.trim().replace(/^["']|["']$/g, "");
  if (!value) {
    throw new Error(`${key} not set — add it in Settings → API Tokens`);
  }
  return value;
}
