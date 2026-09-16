// Manual access codes: 7-digit codes the owner hands out (e.g. buyers of a
// discounted payment link). Redeeming one activates the member's subscription
// row for the configured number of months.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AccessCode {
  code: string;
  label: string | null;
  months: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

function randomCode() {
  // 7 digits, never leading-zero-ambiguous (1000000–9999999)
  const n = 1_000_000 + Math.floor(Math.random() * 9_000_000);
  return String(n);
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: Boolean(data) };
  });

export const listAccessCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("access_codes")
      .select("code,label,months,max_uses,used_count,expires_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as AccessCode[];
  });

export const createAccessCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { count?: number; label?: string; months?: number; maxUses?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const count = Math.min(Math.max(data.count ?? 1, 1), 50);
    const rows = Array.from({ length: count }, () => ({
      code: randomCode(),
      label: data.label?.trim() || null,
      months: Math.min(Math.max(data.months ?? 1, 1), 60),
      max_uses: Math.min(Math.max(data.maxUses ?? 1, 1), 1000),
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from("access_codes")
      .insert(rows)
      .select("code");
    if (error) throw error;
    return { codes: (inserted ?? []).map((r) => r.code) };
  });

export const revokeAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("access_codes").delete().eq("code", data.code);
    if (error) throw error;
    return { ok: true };
  });

export const redeemAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const code = data.code.replace(/\D/g, "");
    if (code.length !== 7) return { ok: false as const, error: "invalid_code" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("access_codes")
      .select("code,months,max_uses,used_count,expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!row) return { ok: false as const, error: "invalid_code" };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { ok: false as const, error: "expired" };
    }
    if (row.used_count >= row.max_uses) return { ok: false as const, error: "already_used" };

    const { error: redeemErr } = await supabaseAdmin
      .from("code_redemptions")
      .insert({ code, user_id: context.userId });
    // Unique violation = this member already redeemed this code.
    if (redeemErr) return { ok: false as const, error: "already_used" };

    await supabaseAdmin
      .from("access_codes")
      .update({ used_count: row.used_count + 1 })
      .eq("code", code);

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + row.months);

    const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert({
      user_id: context.userId,
      status: "active",
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (subErr) throw subErr;

    return { ok: true as const, months: row.months, until: periodEnd.toISOString() };
  });
