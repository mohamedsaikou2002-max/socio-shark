// Cron endpoint — called every minute by pg_cron. Posts any due "scheduled" rows.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { postNow } from "@/lib/socio.functions";

export const Route = createFileRoute("/api/public/hooks/run-due")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("posts").select("id")
          .eq("status", "scheduled")
          .lte("scheduled_for", now)
          .limit(10);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const results: unknown[] = [];
        for (const p of due ?? []) {
          // mark in-flight
          await supabaseAdmin.from("posts").update({ status: "posting" }).eq("id", p.id);
          const r = await postNow({ data: { postId: p.id } });
          results.push({ id: p.id, ...r });
        }
        return Response.json({ ran: results.length, results });
      },
      GET: async () => Response.json({ ok: true, message: "Socio-Shark cron endpoint" }),
    },
  },
});
