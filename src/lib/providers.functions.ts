// providers.functions.ts
// Server entry point for provider verification: dispatches a provider id to
// that provider's testAuth(). Used by the Settings "Test" buttons and
// automatically after every secret save (see secrets.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { providerById, type ProviderId, type ProviderTestResult } from "@/lib/providers/registry";
import { testMetaAuth } from "@/lib/providers/meta";
import { testTikTokAuth } from "@/lib/providers/tiktok";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TESTS: Record<ProviderId, () => Promise<ProviderTestResult>> = {
  meta: testMetaAuth,
  tiktok: testTikTokAuth,
};

/** Run a provider's testAuth(). Never throws — failures come back as results. */
export async function runProviderTest(providerId: string): Promise<ProviderTestResult> {
  const provider = providerById(providerId);
  if (!provider) {
    return { providerId, ok: false, status: 0, message: `Unknown provider "${providerId}"` };
  }
  try {
    return await TESTS[provider.id]();
  } catch (e) {
    return { providerId, ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}

export const testProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { providerId: string }) => d)
  .handler(async ({ data }) => runProviderTest(data.providerId));
