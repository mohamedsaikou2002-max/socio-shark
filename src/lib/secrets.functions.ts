// secrets.functions.ts
// Server-only: save and retrieve API keys from app_secrets table
// The browser NEVER touches this table directly — all through server fns

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ── Save a secret ────────────────────────────────────────────────────────────
export const saveSecret = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; value: string }) => d)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("app_secrets")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true };
  });

// ── Check which secrets are set (returns keys only, never values) ────────────
export const listSecretKeys = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("app_secrets")
    .select("key, updated_at");
  if (error) throw error;
  return (data ?? []) as { key: string; updated_at: string }[];
});

// ── Delete a secret ──────────────────────────────────────────────────────────
export const deleteSecret = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("app_secrets")
      .delete()
      .eq("key", data.key);
    if (error) throw error;
    return { ok: true };
  });

// ── Internal helper: get a secret value (used by other server fns) ───────────
export async function getSecret(key: string): Promise<string | null> {
  // Prefer environment variable first
  const envVal = process.env[key];
  if (envVal) return envVal;

  // Fall back to DB
  const { data } = await supabaseAdmin
    .from("app_secrets")
    .select("value")
    .eq("key", key)
    .single();

  return data?.value ?? null;
}
