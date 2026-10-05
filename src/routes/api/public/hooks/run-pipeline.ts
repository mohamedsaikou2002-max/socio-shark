// Cron-triggered auto-generation. Schedule via pg_cron + pg_net to call this endpoint.
// Example: POST https://your-domain/api/public/hooks/run-pipeline  body: {"count": 3}
import { createFileRoute } from "@tanstack/react-router";
import { runBatchPipeline } from "@/lib/content-pipeline.functions";

export const Route = createFileRoute("/api/public/hooks/run-pipeline")({
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
        let count = 1;
        let hashtags: string | undefined;
        try {
          const body = await request.json();
          if (typeof body?.count === "number") count = body.count;
          if (typeof body?.hashtags === "string") hashtags = body.hashtags;
        } catch { /* no body, use defaults */ }
        const r = await runBatchPipeline({ data: { count, hashtags } });
        return Response.json(r);
      },
      GET: async () => Response.json({ ok: true, hint: "POST {count: N, hashtags?: string}" }),
    },
  },
});
