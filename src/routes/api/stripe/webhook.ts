import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_SIGNATURE_AGE_SECONDS = 300;

const STRIPE_PLANS = [
  { key: "single", accountLimit: 1, amountCents: 30_000, linkId: "STRIPE_PAYMENT_LINK_ID_1" },
  { key: "team", accountLimit: 3, amountCents: 50_000, linkId: "STRIPE_PAYMENT_LINK_ID_3" },
  { key: "agency", accountLimit: 5, amountCents: 80_000, linkId: "STRIPE_PAYMENT_LINK_ID_5" },
] as const;

async function getStripeSubscription(id: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) throw new Error("Could not verify Stripe subscription");
  return await response.json() as {
    id: string;
    customer?: string | null;
    status: string;
    current_period_end?: number | null;
  };
}

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
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        const configuredPlans = STRIPE_PLANS.map((plan) => ({ ...plan, paymentLinkId: process.env[plan.linkId] }));
        if (!secret || !stripeSecretKey || configuredPlans.some((plan) => !plan.paymentLinkId)) {
          return Response.json({ error: "Stripe subscription plans are not fully configured" }, { status: 503 });
        }
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
            subscription?: string | { id?: string } | null;
            status?: string;
            current_period_end?: number | null;
          } };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid event body" }, { status: 400 });
        }
        if (!event.id || !event.type) return Response.json({ error: "Invalid event" }, { status: 400 });

        const { data: priorEvent, error: priorError } = await supabaseAdmin
          .from("stripe_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
        if (priorError) return Response.json({ error: "Unable to check event receipt" }, { status: 500 });
        if (priorEvent) return Response.json({ received: true, duplicate: true });

        const object = event.data?.object;
        if (!object) return Response.json({ error: "Missing event object" }, { status: 400 });
        let handled = false;

        if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
          const session = object;
          const plan = configuredPlans.find((item) => item.paymentLinkId === session.payment_link);
          const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (
            !session.id || !session.client_reference_id || session.payment_status !== "paid" ||
            session.mode !== "subscription" || !stripeSubscriptionId || !plan ||
            session.amount_total !== plan.amountCents || session.currency?.toLowerCase() !== "usd"
          ) {
            return Response.json({ error: "Checkout does not match a configured monthly subscription plan" }, { status: 400 });
          }

          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles").select("id").eq("id", session.client_reference_id).maybeSingle();
          if (profileError || !profile) {
            return Response.json({ error: "Checkout session does not match a Socio-Shark account" }, { status: 400 });
          }

          let stripeSubscription;
          try {
            stripeSubscription = await getStripeSubscription(stripeSubscriptionId, stripeSecretKey!);
          } catch {
            return Response.json({ error: "Unable to verify subscription status with Stripe" }, { status: 503 });
          }
          if (stripeSubscription.status !== "active" && stripeSubscription.status !== "trialing") {
            return Response.json({ error: "Stripe subscription is not active" }, { status: 402 });
          }
          const { error: accessError } = await supabaseAdmin.from("subscriptions").upsert({
            user_id: profile.id,
            status: stripeSubscription.status,
            stripe_customer_id: stripeSubscription.customer ?? session.customer ?? null,
            stripe_subscription_id: stripeSubscription.id,
            stripe_checkout_session_id: session.id,
            amount_paid_cents: plan.amountCents,
            currency: "usd",
            current_period_end: stripeSubscription.current_period_end
              ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
              : null,
            plan_key: plan.key,
            account_limit: plan.accountLimit,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          if (accessError) return Response.json({ error: "Unable to activate subscription access" }, { status: 500 });
          handled = true;
        } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
          const subscription = object;
          if (!subscription.id || !subscription.status) return Response.json({ error: "Invalid subscription event" }, { status: 400 });
          const { error: updateError } = await supabaseAdmin.from("subscriptions").update({
            status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          }).eq("stripe_subscription_id", subscription.id);
          if (updateError) return Response.json({ error: "Unable to update subscription status" }, { status: 500 });
          handled = true;
        }

        if (!handled) return Response.json({ received: true, ignored: true });
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
