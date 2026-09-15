import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMembership, isActive, signOut } from "@/hooks/useAuth";
import { checkoutUrl, MEMBERSHIP_PRICE } from "@/lib/billing";
import { SharkLogo } from "@/components/SharkLogo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: MemberGate,
});

const PERKS = [
  "Unlimited AI video generation from your product photos",
  "Bulk photo + ZIP import and saved prompt library",
  "Auto-captioning and the autonomous content pipeline",
  "Scheduled auto-posting to TikTok & Instagram",
];

function MemberGate() {
  const { user } = useAuth();
  const { data: membership, isLoading, refetch } = useMembership(user?.id);

  if (isLoading) {
    return (
      <div className="py-20 text-center font-mono text-sm text-muted-foreground">
        checking membership…
      </div>
    );
  }

  if (isActive(membership)) return <Outlet />;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <div className="flex items-center gap-2">
        <SharkLogo className="h-7 w-7 text-foreground" />
        <h1 className="font-mono text-lg font-bold tracking-tight">Membership required</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Every tool in Socio-Shark is locked until your membership is active. Signed in as{" "}
        <span className="text-foreground">{user?.email}</span>.
      </p>
      <div className="border border-border p-5 space-y-4">
        <p className="font-mono text-3xl">
          {MEMBERSHIP_PRICE}
          <span className="text-sm text-muted-foreground">/month</span>
        </p>
        <ul className="space-y-2 text-sm">
          {PERKS.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="font-mono">—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <a
          href={user ? checkoutUrl(user.id, user.email) : "#"}
          className="block w-full bg-foreground px-4 py-2 text-center font-mono text-sm text-background hover:opacity-90"
        >
          Start membership — {MEMBERSHIP_PRICE}/mo
        </a>
        <button
          onClick={() => refetch()}
          className="w-full border border-border px-4 py-2 font-mono text-xs hover:bg-muted"
        >
          I already paid — refresh status
        </button>
      </div>
      <button
        onClick={() => signOut()}
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        sign out
      </button>
    </div>
  );
}
