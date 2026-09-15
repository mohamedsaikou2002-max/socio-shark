import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verify(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ACTIVE = new Set(["active", "trialing"]);

export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        const body = await request.text();
        if (!verify(body, request.headers.get("stripe-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as { type: string; data: { object: Record<string, any> } };
        const obj = event.data.object;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const periodEnd = (s: number | null | undefined) =>
          s ? new Date(s * 1000).toISOString() : null;

        if (event.type === "checkout.session.completed") {
          const userId = obj["client_reference_id"] as string | null;
          if (userId) {
            await supabaseAdmin.from("subscriptions").upsert({
              user_id: userId,
              status: "active",
              stripe_customer_id: (obj["customer"] as string) ?? null,
              stripe_subscription_id: (obj["subscription"] as string) ?? null,
              updated_at: new Date().toISOString(),
            });
          }
        } else if (event.type.startsWith("customer.subscription.")) {
          const customer = obj["customer"] as string | null;
          const status = event.type === "customer.subscription.deleted"
            ? "canceled"
            : (obj["status"] as string);
          if (customer) {
            await supabaseAdmin
              .from("subscriptions")
              .update({
                status: ACTIVE.has(status) ? status : "inactive",
                stripe_subscription_id: (obj["id"] as string) ?? null,
                current_period_end: periodEnd(obj["current_period_end"] as number),
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_customer_id", customer);
          }
        } else if (event.type === "invoice.payment_failed") {
          const customer = obj["customer"] as string | null;
          if (customer) {
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "past_due", updated_at: new Date().toISOString() })
              .eq("stripe_customer_id", customer);
          }
        }

        return new Response("ok");
      },
    },
  },
});
