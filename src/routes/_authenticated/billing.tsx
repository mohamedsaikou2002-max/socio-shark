import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const PAYMENT_LINK = "https://buy.stripe.com/bJeeVd8Wmc5t6GN8v943S02";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Socio-Shark" },
      { name: "description", content: "Manage your Socio-Shark monthly membership and access." },
      { property: "og:title", content: "Billing — Socio-Shark" },
      { property: "og:description", content: "Manage your Socio-Shark monthly membership and access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { user } = useAuth();
  const checkout = `${PAYMENT_LINK}?client_reference_id=${encodeURIComponent(user?.id ?? "")}&prefilled_email=${encodeURIComponent(user?.email ?? "")}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="border-b border-border pb-6">
        <p className="font-mono text-xs uppercase text-muted-foreground">Plan & access</p>
        <h1 className="mt-2 text-3xl font-bold">One plan. The full machine.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Run the complete content workflow for one simple monthly price.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="border border-foreground bg-foreground p-6 text-background sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-background/20 pb-6">
            <div>
              <p className="font-mono text-xs uppercase opacity-65">Socio-Shark membership</p>
              <p className="mt-3 text-4xl font-bold">$297 <span className="text-base font-normal opacity-65">/ month</span></p>
            </div>
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <ul className="my-6 grid gap-3 text-sm sm:grid-cols-2">
            {["Automated content pipeline", "Instagram + TikTok workflows", "Scheduled daily publishing", "Caption review and editing", "Bulk media handling", "Cancel anytime"].map((perk) => (
              <li key={perk} className="flex items-center gap-2"><Check className="h-4 w-4" />{perk}</li>
            ))}
          </ul>
          <Button asChild variant="secondary" className="w-full justify-between font-mono">
            <a href={checkout} target="_blank" rel="noreferrer">Subscribe for $297/month <ArrowUpRight /></a>
          </Button>
        </section>

        <aside className="border border-border p-5">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
          <h2 className="mt-4 font-bold">Have a client code?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Use the seven-digit code supplied with a discounted client plan.</p>
          <Button asChild variant="outline" className="mt-5 w-full font-mono"><Link to="/activate">Enter access code</Link></Button>
        </aside>
      </div>
    </div>
  );
}
