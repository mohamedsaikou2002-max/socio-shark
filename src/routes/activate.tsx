import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SharkLogo } from "@/components/SharkLogo";
import { useAuth } from "@/hooks/useAuth";
import { redeemAccessCode } from "@/lib/access-codes.functions";

export const Route = createFileRoute("/activate")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redeem access code — Socio-Shark" },
      {
        name: "description",
        content:
          "Redeem your 7-digit Socio-Shark access code to unlock the autonomous content pipeline on your account.",
      },
      { property: "og:title", content: "Redeem access code — Socio-Shark" },
      {
        property: "og:description",
        content: "Unlock Socio-Shark with the 7-digit access code you were given.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivatePage,
});

const MESSAGES: Record<string, string> = {
  invalid_code: "That code doesn't match anything. Double check and try again.",
  already_used: "This code has already been used up.",
  expired: "This code has expired.",
};

function ActivatePage() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const redeem = useServerFn(redeemAccessCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await redeem({ data: { code } });
      if (!res.ok) {
        setError(MESSAGES[res.error] ?? "Couldn't redeem that code.");
        return;
      }
      toast.success("Membership activated. Welcome aboard.");
      navigate({ to: "/" });
    } catch {
      setError("Couldn't reach the activation service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center font-mono text-sm text-muted-foreground">loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-sm px-1 py-16 text-center">
        <SharkLogo className="mx-auto h-10 w-10 text-foreground" />
        <h1 className="mt-4 font-mono text-xl font-bold tracking-tight">Sign in first</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access codes attach to your account, so create an account or sign in before redeeming.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-block w-full bg-foreground px-4 py-2 font-mono text-sm text-background"
        >
          Sign in / create account
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-1 py-10 sm:py-16">
      <div className="flex items-center gap-2">
        <SharkLogo className="h-8 w-8 shrink-0 text-foreground" />
        <h1 className="font-mono text-xl font-bold tracking-tight">Redeem access code</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the 7-digit code you were given. It activates membership on{" "}
        <span className="text-foreground">{user.email}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{7}"
          maxLength={7}
          placeholder="0000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full border border-border bg-background px-3 py-3 text-center text-lg tracking-[0.4em] text-foreground outline-none focus:border-foreground"
          autoComplete="one-time-code"
          required
        />
        <button
          type="submit"
          disabled={busy || code.length !== 7}
          className="bg-foreground px-4 py-2.5 font-mono text-sm text-background disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Activate"}
        </button>
        {error && (
          <p role="alert" className="border border-border px-3 py-2 text-sm text-foreground">
            {error}
          </p>
        )}
      </form>

      <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
        No code?{" "}
        <Link to="/" className="underline underline-offset-4 hover:text-foreground">
          Start a $297/mo membership instead
        </Link>
      </div>
    </div>
  );
}
