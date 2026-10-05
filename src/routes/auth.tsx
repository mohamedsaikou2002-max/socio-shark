import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { SharkLogo } from "@/components/SharkLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Socio-Shark" },
      { name: "description", content: "Sign in to manage your private Socio-Shark media library and review queue." },
      { property: "og:title", content: "Sign in — Socio-Shark" },
      { property: "og:description", content: "Create an account to organize, review, and schedule your social content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Google sign-in uses the managed broker (works in the preview iframe and on
  // the published Lovable domain).
  async function google() {
    if (googleBusy) return;
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      }) as { error?: unknown } | undefined;
      if (result?.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <SharkLogo className="h-8 w-8 text-foreground" />
          <span className="font-mono text-lg font-bold tracking-tight">SOCIO-SHARK</span>
        </div>

        {sent ? (
          <div className="space-y-3 border border-border p-5">
            <h1 className="font-mono text-sm uppercase tracking-wider">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it
              to verify your address, then sign in.
            </p>
            <button
              onClick={() => { setSent(false); setMode("signin"); }}
              className="w-full border border-border px-4 py-2 font-mono text-sm hover:bg-muted"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an account, or sign in if you already have one.
              </p>
            </div>

            <button
              onClick={google}
              disabled={googleBusy}
              className="flex w-full items-center justify-center gap-2 border border-border px-4 py-2 font-mono text-sm hover:bg-muted disabled:opacity-50"
            >
              {googleBusy ? "Redirecting…" : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3 text-[10px] font-mono uppercase text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase">Email</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-border bg-background px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase">Password</label>
                <input
                  type="password" required minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-border bg-background px-3 py-2 font-mono text-sm"
                />
              </div>
              <button
                type="submit" disabled={busy}
                className="w-full bg-foreground px-4 py-2 font-mono text-sm text-background disabled:opacity-50"
              >
                {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-center font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
            </button>
          </>
        )}

        <p className="text-center font-mono text-[10px] text-muted-foreground">
          An active subscription is required to unlock the app
        </p>
      </div>
    </div>
  );
}
