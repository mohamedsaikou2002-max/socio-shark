import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SharkLogo } from "@/components/SharkLogo";
import { useAuth } from "@/hooks/useAuth";
import {
  createAccessCodes,
  isAdmin,
  listAccessCodes,
  revokeAccessCode,
} from "@/lib/access-codes.functions";

export const Route = createFileRoute("/codes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Access codes — Socio-Shark" },
      {
        name: "description",
        content: "Create and manage the 7-digit access codes you hand out to Socio-Shark clients.",
      },
      { property: "og:title", content: "Access codes — Socio-Shark" },
      { property: "og:description", content: "Manage Socio-Shark client access codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CodesPage,
});

function CodesPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const adminFn = useServerFn(isAdmin);
  const listFn = useServerFn(listAccessCodes);
  const createFn = useServerFn(createAccessCodes);
  const revokeFn = useServerFn(revokeAccessCode);

  const admin = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: Boolean(user),
    queryFn: () => adminFn(),
  });

  const codes = useQuery({
    queryKey: ["access-codes"],
    enabled: Boolean(admin.data?.admin),
    queryFn: () => listFn(),
  });

  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [months, setMonths] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);

  if (loading || (user && admin.isLoading)) {
    return (
      <div className="py-20 text-center font-mono text-sm text-muted-foreground">loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center">
        <p className="text-sm text-muted-foreground">Sign in to manage access codes.</p>
        <Link to="/auth" className="mt-4 inline-block bg-foreground px-4 py-2 font-mono text-sm text-background">
          Sign in
        </Link>
      </div>
    );
  }

  if (!admin.data?.admin) {
    return (
      <div className="mx-auto max-w-sm py-20 text-center font-mono text-sm text-muted-foreground">
        This page is for account owners only.
      </div>
    );
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await createFn({ data: { count, label, months, maxUses } });
      toast.success(`Created ${res.codes.length} code${res.codes.length === 1 ? "" : "s"}.`);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["access-codes"] });
    } catch {
      toast.error("Couldn't create codes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="flex items-center gap-2">
        <SharkLogo className="h-7 w-7 text-foreground" />
        <h1 className="font-mono text-lg font-bold tracking-tight">Access codes</h1>
      </div>

      <div className="space-y-3 border border-border p-4">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Create codes
        </p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. discounted link buyers)"
          className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        />
        <div className="grid grid-cols-3 gap-3">
          <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            How many
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />
          </label>
          <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Months
            <input
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-1 w-full border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />
          </label>
          <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Uses each
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="mt-1 w-full border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-foreground"
            />
          </label>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="w-full bg-foreground px-4 py-2 font-mono text-sm text-background disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create codes"}
        </button>
      </div>

      <div className="border border-border">
        {(codes.data ?? []).length === 0 && (
          <p className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            No codes yet.
          </p>
        )}
        {(codes.data ?? []).map((c) => (
          <div
            key={c.code}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(c.code);
                  toast.message("Code copied.");
                }}
                className="font-mono text-base tracking-[0.3em] hover:underline"
              >
                {c.code}
              </button>
              <p className="text-xs text-muted-foreground">
                {c.label ? `${c.label} — ` : ""}
                {c.months} month{c.months === 1 ? "" : "s"} · used {c.used_count}/{c.max_uses}
              </p>
            </div>
            <button
              onClick={async () => {
                await revokeFn({ data: { code: c.code } });
                qc.invalidateQueries({ queryKey: ["access-codes"] });
              }}
              className="border border-border px-3 py-1 font-mono text-xs hover:bg-muted"
            >
              delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
