// GET /api/public/license-status  (Authorization: Bearer <license_token>)
// Verifies an opaque token issued by /api/public/activate, so the frontend
// never trusts localStorage alone as proof of a paid license.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json } from "@/lib/activation.server";

export const Route = createFileRoute("/api/public/license-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const header = request.headers.get("authorization");
        const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
        if (!token) return json({ licensed: false, error: "missing_token" }, 401);

        const { data } = await supabaseAdmin
          .from("activations")
          .select("expires_at")
          .eq("license_token", token)
          .maybeSingle();

        const licensed = !!data && new Date(data.expires_at).getTime() > Date.now();
        return json({ licensed });
      },
    },
  },
});
