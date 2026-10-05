// Cron endpoint — called every minute by pg_cron. Posts any due "scheduled" rows.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { postNow } from "@/lib/socio.functions";
import { getTikTokPublishStatus } from "@/lib/providers/tiktok";

export const Route = createFileRoute("/api/public/hooks/run-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return Response.json({ error: "Cron endpoint is not configured" }, { status: 503 });
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const now = new Date().toISOString();
        const { data: pending, error: pendingError } = await supabaseAdmin.from("posts")
          .select("id,tiktok_post_id,error")
          .eq("status", "posting")
          .not("tiktok_post_id", "is", null)
          .limit(10);
        if (pendingError) return Response.json({ error: pendingError.message }, { status: 500 });
        const completed: unknown[] = [];
        for (const p of pending ?? []) {
          try {
            const state = await getTikTokPublishStatus(p.tiktok_post_id!);
            if (state.status === "PUBLISH_COMPLETE" || state.status === "FAILED") {
              const failed = state.status === "FAILED" || Boolean(p.error);
              const { error: updateError } = await supabaseAdmin.from("posts").update({
                status: failed ? "failed" : "posted",
                posted_at: state.status === "PUBLISH_COMPLETE" ? new Date().toISOString() : null,
                error: state.status === "FAILED" ? (state.reason ?? "TikTok publish failed") : p.error,
              }).eq("id", p.id).eq("status", "posting");
              completed.push({ id: p.id, status: state.status, error: updateError?.message });
            }
          } catch (e) {
            completed.push({ id: p.id, error: e instanceof Error ? e.message : String(e) });
          }
        }
        const { data: due, error } = await supabaseAdmin
          .from("posts").select("id")
          .eq("status", "scheduled")
          .lte("scheduled_for", now)
          .limit(10);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const results: unknown[] = [];
        for (const p of due ?? []) {
          try {
            const r = await postNow({ data: { postId: p.id } });
            results.push({ id: p.id, ...r });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            await supabaseAdmin.from("posts").update({ status: "failed", error: message })
              .eq("id", p.id).eq("status", "scheduled");
            results.push({ id: p.id, ok: false, error: message });
          }
        }
        return Response.json({ ran: results.length, results, checked: completed.length, completed });
      },
      GET: async () => Response.json({ ok: true, message: "Socio-Shark cron endpoint" }),
    },
  },
});
