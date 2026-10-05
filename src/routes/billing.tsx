import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_PLANS } from "@/lib/plans";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [
    { title: "Get access — Socio-Shark" },
    { name: "description", content: "Choose a monthly Socio-Shark plan for one, three, or five connected social accounts." },
    { property: "og:title", content: "Get access — Socio-Shark" },
    { property: "og:description", content: "Choose a monthly Socio-Shark plan for one, three, or five connected social accounts." },
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
  const paymentLinks: Record<string, string | undefined> = {
    single: import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL_1,
    team: import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL_3,
    agency: import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL_5,
  };
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

  function checkoutUrl(planKey: string) {
    const paymentLink = paymentLinks[planKey];
    return user && paymentLink
      ? `${paymentLink}${paymentLink.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(user.id)}&prefilled_email=${encodeURIComponent(user.email ?? "")}`
      : undefined;
  }

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
      <section className="grid gap-4 md:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const link = checkoutUrl(plan.key);
          return <article key={plan.key} className="flex flex-col border border-border p-5">
            <p className="font-mono text-xs uppercase text-muted-foreground">{plan.name}</p>
            <p className="mt-3 text-3xl font-bold">${plan.price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
            <ul className="my-5 flex-1 space-y-2 text-sm">
              {[`${plan.accountLimit} connected account${plan.accountLimit === 1 ? "" : "s"}`, "Private media library", "Review queue and scheduling"].map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4" />{item}</li>)}
            </ul>
            {!session ? <Button asChild variant="outline" className="w-full"><Link to="/auth">Sign in to choose</Link></Button>
              : link ? <Button asChild className="w-full justify-between font-mono"><a href={link}>Choose ${plan.price}/month <ArrowUpRight /></a></Button>
              : <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">Payment link for this plan is not configured yet.</p>}
          </article>;
        })}
      </section>
      {session && <p className="text-xs text-muted-foreground">Access starts after Stripe confirms the first successful monthly payment. Cancelled or unpaid subscriptions lose access when their paid period ends. Signed in as {user?.email}</p>}
      {returned && (
        <p role="status" className="border border-border p-4 text-sm">Stripe returned successfully. Waiting for verified payment confirmation…</p>
      )}
    </main>
  );
}
