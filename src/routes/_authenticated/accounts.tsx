import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Instagram, Link2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SOCIAL_ACCOUNTS_KEY, readLocalList, writeLocalList, type LocalSocialAccount, type SocialPlatform } from "@/lib/frontend-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [
    { title: "Connected accounts — Socio-Shark" },
    { name: "description", content: "Manage Instagram and TikTok destinations in Socio-Shark." },
    { property: "og:title", content: "Connected accounts — Socio-Shark" },
    { property: "og:description", content: "Manage Instagram and TikTok destinations in Socio-Shark." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountsPage,
});

const PLATFORMS: { id: SocialPlatform; name: string; detail: string }[] = [
  { id: "instagram", name: "Instagram", detail: "Reels and business publishing" },
  { id: "tiktok", name: "TikTok", detail: "Direct video publishing" },
];

function AccountsPage() {
  const [accounts, setAccounts] = useState<LocalSocialAccount[]>([]);
  const [draft, setDraft] = useState<SocialPlatform | null>(null);
  const [label, setLabel] = useState("");
  const { user } = useAuth();
  const { data: plan } = useQuery({
    queryKey: ["account-plan", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("account_limit,plan_key")
        .eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const accountLimit = plan?.account_limit ?? 1;
  const atLimit = accounts.length >= accountLimit;

  useEffect(() => setAccounts(readLocalList<LocalSocialAccount>(SOCIAL_ACCOUNTS_KEY)), []);

  function stageConnection(platform: SocialPlatform) {
    if (accounts.length >= accountLimit) {
      toast.error(`Your plan includes up to ${accountLimit} connected account${accountLimit === 1 ? "" : "s"}.`);
      return;
    }
    const next: LocalSocialAccount = { id: crypto.randomUUID(), platform, label: label.trim(), status: "connected" };
    const updated = [...accounts, next];
    setAccounts(updated);
    writeLocalList(SOCIAL_ACCOUNTS_KEY, updated);
    setDraft(null);
    setLabel("");
    toast.success("Account slot saved. OAuth connection is ready for backend setup.");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div><p className="font-mono text-xs uppercase text-muted-foreground">Publishing destinations</p><h1 className="mt-2 text-3xl font-bold">Connected accounts</h1></div>
        <p className="max-w-sm text-sm text-muted-foreground">Your {plan?.plan_key ?? "current"} plan includes {accountLimit} connected social account{accountLimit === 1 ? "" : "s"} total across Instagram and TikTok. {accounts.length} of {accountLimit} slots used.</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const linked = accounts.filter((account) => account.platform === platform.id);
          return (
            <section key={platform.id} className="border border-border">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div className="flex items-center gap-3">{platform.id === "instagram" ? <Instagram /> : <span className="font-mono text-lg font-black">TT</span>}<div><h2 className="font-bold">{platform.name}</h2><p className="text-xs text-muted-foreground">{platform.detail}</p></div></div>
                <span className="font-mono text-xs text-muted-foreground">{linked.length} linked</span>
              </div>
              <div className="min-h-40 p-4">
                {linked.length === 0 ? <div className="flex min-h-28 flex-col items-center justify-center border border-dashed border-border text-center"><Link2 className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-sm">No account connected</p></div> : linked.map((account) => (
                  <div key={account.id} className="mb-2 flex items-center justify-between border border-border p-3"><div><p className="text-sm font-medium">{account.label}</p><p className="font-mono text-[10px] uppercase text-muted-foreground">{account.status}</p></div><Button variant="ghost" size="icon" title="Refresh connection" aria-label="Refresh connection"><RefreshCw /></Button></div>
                ))}
              </div>
              <div className="border-t border-border p-4">
                {draft === platform.id ? (
                  <div className="space-y-2"><label className="font-mono text-[10px] uppercase">Business label</label><input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Main brand" className="h-10 w-full border border-input bg-background px-3 text-sm" /><div className="flex gap-2"><Button onClick={() => stageConnection(platform.id)} disabled={!label.trim()} className="flex-1">Continue</Button><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button></div></div>
                ) : <Button variant="outline" className="w-full" disabled={atLimit} onClick={() => setDraft(platform.id)}><Plus />{atLimit ? "Plan account limit reached" : `Connect ${platform.name}`}</Button>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="flex gap-3 border border-border p-4 text-sm text-muted-foreground"><AlertTriangle className="h-5 w-5 shrink-0 text-foreground" /><p>Connection slots are available in the interface. Live OAuth authorization activates when its matching backend configuration is connected.</p></div>
    </div>
  );
}
