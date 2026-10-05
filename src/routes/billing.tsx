import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [
    { title: "Get access — Socio-Shark" },
    { name: "description", content: "Unlock your private Socio-Shark content library with a one-time $300 payment." },
    { property: "og:title", content: "Get access — Socio-Shark" },
    { property: "og:description", content: "Unlock your private Socio-Shark content library with a one-time $300 payment." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: BillingPage,
});

function BillingPage() {
  const navigate = useNavigate();
  const { user, session, loading } = useAuth();
  const [returned, setReturned] = useState(false);
  useEffect(() => { setReturned(new URLSearchParams(window.location.search).get("checkout") === "success"); }, []);
  const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL;
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: Boolean(user),
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("status,current_period_end")
        .eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (subscription?.status === "active" || subscription?.status === "trialing") {
      void navigate({ to: "/" });
    }
  }, [subscription, navigate]);

  const checkoutUrl = user && paymentLink
    ? `${paymentLink}${paymentLink.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(user.id)}&prefilled_email=${encodeURIComponent(user.email ?? "")}`
    : undefined;

  if (loading || (user && isLoading)) return <main className="mx-auto max-w-xl p-8">Checking access…</main>;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-16">
      <header>
        <p className="font-mono text-xs uppercase text-muted-foreground">Account access</p>
        <h1 className="mt-2 text-3xl font-bold">Unlock Socio-Shark</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in or create an account, then complete the secure Stripe checkout.</p>
      </header>
      {!session && (
        <div className="border border-border p-5">
          <p className="text-sm">Sign in with Google or create an email and password account first. Your payment will be attached to that account.</p>
          <Button asChild className="mt-4"><Link to="/auth">Sign in or create account</Link></Button>
        </div>
      )}
      {session && (
        <section className="border border-foreground bg-foreground p-6 text-background sm:p-8">
          <div className="flex items-center justify-between border-b border-background/20 pb-5">
            <div>
              <p className="font-mono text-xs uppercase opacity-65">One-time access</p>
              <p className="mt-2 text-4xl font-bold">$300</p>
            </div>
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <ul className="my-5 grid gap-3 text-sm sm:grid-cols-2">
            {["Content library and bulk uploads", "Instagram and TikTok workflow", "Scheduling and publishing", "Client-isolated Supabase storage"].map((item) => (
              <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4" />{item}</li>
            ))}
          </ul>
          {checkoutUrl ? (
            <Button asChild variant="secondary" className="w-full justify-between font-mono">
              <a href={checkoutUrl}>Pay $300 and unlock access <ArrowUpRight /></a>
            </Button>
          ) : (
            <p className="border border-background/30 p-3 text-sm">Stripe is not configured yet. Add VITE_STRIPE_PAYMENT_LINK_URL for the $300 one-time payment link.</p>
          )}
          <p className="mt-4 text-xs opacity-70">Access activates only after Stripe confirms a successful $300 USD payment. Failed, cancelled, or incomplete checkouts stay locked.</p>
          <p className="mt-4 font-mono text-xs opacity-70">Signed in as {user?.email}</p>
        </section>
      )}
      {returned && (
        <p role="status" className="border border-border p-4 text-sm">Stripe returned successfully. Waiting for verified payment confirmation…</p>
      )}
    </main>
  );
}
