// POST /api/public/activate  { session_id, code } -> { ok, license_token }
// GET  /api/public/activate?session_id=...        -> { code } for the post-payment success page
//
// Server-verified activation: the 6-digit code is derived from a real,
// PAID Stripe Checkout Session with a server-only secret, so it can't be
// guessed or generated offline. Each session can only be redeemed once.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deriveActivationCode,
  getActivationSecrets,
  json,
  verifyStripeSession,
} from "@/lib/activation.server";

export const Route = createFileRoute("/api/public/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { session_id?: string; code?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const sessionId = body.session_id?.trim();
        const code = body.code?.trim();
        if (!sessionId || !code) return json({ error: "missing_fields" }, 400);

        const { stripeKey, hmacSecret } = await getActivationSecrets();
        if (!stripeKey || !hmacSecret) return json({ error: "not_configured" }, 503);

        // One redemption per checkout session.
        const { data: existing } = await supabaseAdmin
          .from("activations")
          .select("id")
          .eq("session_id", sessionId)
          .maybeSingle();
        if (existing) return json({ error: "code_already_used" }, 409);

        const session = await verifyStripeSession(sessionId, stripeKey);
        if (!session || session.payment_status !== "paid") {
          return json({ error: "session_not_paid" }, 402);
        }

        const expected = await deriveActivationCode(sessionId, hmacSecret);
        if (code !== expected) return json({ error: "invalid_code" }, 401);

        const licenseToken = crypto.randomUUID();
        const { error } = await supabaseAdmin
          .from("activations")
          .insert({ session_id: sessionId, license_token: licenseToken });
        // Unique violation = someone redeemed concurrently.
        if (error) return json({ error: "code_already_used" }, 409);

        return json({ ok: true, license_token: licenseToken });
      },

      // Used by the post-payment success page to display the buyer's code.
      // Computed server-side only, and only once Stripe confirms payment.
      GET: async ({ request }) => {
        const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
        if (!sessionId) return json({ error: "missing_fields" }, 400);

        const { stripeKey, hmacSecret } = await getActivationSecrets();
        if (!stripeKey || !hmacSecret) return json({ error: "not_configured" }, 503);

        const session = await verifyStripeSession(sessionId, stripeKey);
        if (!session || session.payment_status !== "paid") {
          return json({ error: "session_not_paid" }, 402);
        }

        return json({ ok: true, code: await deriveActivationCode(sessionId, hmacSecret) });
      },
    },
  },
});
