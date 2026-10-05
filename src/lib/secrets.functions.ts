// secrets.functions.ts
// Server-only: save and retrieve API keys from app_secrets table
// The browser NEVER touches this table directly — all through server fns
//
// Reading goes through getSecret() (see secrets.core.ts): env var first, DB
// fallback — so a key pasted in Settings works on every code path, including
// the publishing providers.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { providerByKey, allSecretKeys } from "@/lib/providers/registry";
import { runProviderTest } from "@/lib/providers.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Re-exported for existing callers — canonical implementation lives in secrets.core.ts
export { getSecret } from "@/lib/secrets.core";

// ── Save a secret ────────────────────────────────────────────────────────────
export const saveSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; value: string }) => d)
  .handler(async ({ data }) => {
    if (!providerByKey(data.key)) throw new Error("Unknown API key");
    if (!data.value.trim()) throw new Error("API key cannot be empty");
    const { error } = await supabaseAdmin
      .from("app_secrets")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw error;

    // Verify immediately: run the owning provider's testAuth() so a bad paste
    // surfaces now instead of at generation/post time.
    const provider = providerByKey(data.key);
    const test = provider ? await runProviderTest(provider.id) : null;
    return { ok: true as const, key: data.key, test };
  });

// ── Check which secrets are set (returns keys only, never values) ────────────
// Includes keys that exist only as Worker env vars, so the UI badge matches
// what getSecret() can actually resolve.
export const listSecretKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("app_secrets")
    .select("key, updated_at");
  if (error) throw error;

  const rows = new Map<string, { key: string; updated_at: string | null }>();
  for (const r of data ?? []) rows.set(r.key, { key: r.key, updated_at: r.updated_at });
  for (const { key } of allSecretKeys()) {
    if (process.env[key]) rows.set(key, { key, updated_at: null }); // env wins in getSecret
  }
  return [...rows.values()] as { key: string; updated_at: string | null }[];
});

// ── Delete a secret ──────────────────────────────────────────────────────────
export const deleteSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data }) => {
    if (!providerByKey(data.key)) throw new Error("Unknown API key");
    const { error } = await supabaseAdmin
      .from("app_secrets")
      .delete()
      .eq("key", data.key);
    if (error) throw error;
    return { ok: true };
  });
