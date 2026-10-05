import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EXPECTED_AMOUNT_CENTS = 30_000;
const MAX_SIGNATURE_AGE_SECONDS = 300;

async function verifyStripeSignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SIGNATURE_AGE_SECONDS) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => {
    if (candidate.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
    return mismatch === 0;
  });
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const paymentLinkId = process.env.STRIPE_PAYMENT_LINK_ID;
        if (!secret || !paymentLinkId) return Response.json({ error: "Stripe webhook is not configured" }, { status: 503 });
        const rawBody = await request.text();
        if (!(await verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret))) {
          return Response.json({ error: "Invalid Stripe signature" }, { status: 400 });
        }

        let event: {
          id?: string;
          type?: string;
          data?: { object?: {
            id?: string;
            client_reference_id?: string | null;
            payment_status?: string;
            amount_total?: number;
            currency?: string;
            mode?: string;
            payment_link?: string | null;
            customer?: string | null;
          } };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid event body" }, { status: 400 });
        }
        if (!event.id || !event.type) return Response.json({ error: "Invalid event" }, { status: 400 });

        // Async payment methods grant access only after Stripe reports success.
        if (
          event.type !== "checkout.session.completed" &&
          event.type !== "checkout.session.async_payment_succeeded"
        ) return Response.json({ received: true });
        const session = event.data?.object;
        if (
          !session?.id || !session.client_reference_id || session.payment_status !== "paid" ||
          session.mode !== "payment" || session.amount_total !== EXPECTED_AMOUNT_CENTS ||
          session.currency?.toLowerCase() !== "usd" || session.payment_link !== paymentLinkId
        ) {
          return Response.json({ error: "Payment does not match the $300 one-time access plan" }, { status: 400 });
        }

        const { data: priorEvent, error: priorError } = await supabaseAdmin
          .from("stripe_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
        if (priorError) return Response.json({ error: "Unable to check event receipt" }, { status: 500 });
        if (priorEvent) return Response.json({ received: true, duplicate: true });

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles").select("id").eq("id", session.client_reference_id).maybeSingle();
        if (profileError || !profile) {
          return Response.json({ error: "Checkout session does not match a Socio-Shark account" }, { status: 400 });
        }

        const { error: accessError } = await supabaseAdmin.from("subscriptions").upsert({
          user_id: profile.id,
          status: "active",
          stripe_customer_id: session.customer ?? null,
          stripe_checkout_session_id: session.id,
          amount_paid_cents: EXPECTED_AMOUNT_CENTS,
          currency: "usd",
          current_period_end: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (accessError) return Response.json({ error: "Unable to activate paid access" }, { status: 500 });

        const { error: eventError } = await supabaseAdmin.from("stripe_webhook_events").insert({
          event_id: event.id,
          event_type: event.type,
        });
        if (eventError && eventError.code !== "23505") {
          return Response.json({ error: "Unable to record Stripe event" }, { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
