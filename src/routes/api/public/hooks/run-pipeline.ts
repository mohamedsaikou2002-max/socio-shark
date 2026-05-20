// Cron-triggered auto-generation: generates N posts in one shot.
// Schedule with pg_cron: SELECT cron.schedule('auto-gen', '0 9,15,20 * * *', $$SELECT net.http_post(...)$$);
import { createFileRoute } from "@tanstack/react-router";
import { runPipelineBatch } from "@/lib/pipeline.functions";

export const Route = createFileRoute("/api/public/hooks/run-pipeline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let count = 1;
        try {
          const body = await request.json();
          if (typeof body?.count === "number") count = body.count;
        } catch { /* no body, use default */ }
        const r = await runPipelineBatch({ data: { count } });
        return Response.json(r);
      },
      GET: async () => Response.json({ ok: true, message: "POST {count: N} to run pipeline N times" }),
    },
  },
});
