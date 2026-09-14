import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SharkLogo } from "@/components/SharkLogo";
import { UpgradeModal, STRIPE_PAYMENT_LINK } from "@/components/UpgradeModal";
import { LICENSE_TOKEN_KEY, clearLicense, useLicenseCheck } from "@/hooks/useLicenseCheck";

export const Route = createFileRoute("/activate")({
  head: () => ({
    meta: [
      { title: "Activate — Socio-Shark" },
      {
        name: "description",
        content:
          "Enter your checkout session ID and 6-digit activation code to unlock the Socio-Shark autonomous posting pipeline.",
      },
      { property: "og:title", content: "Activate — Socio-Shark" },
      {
        property: "og:description",
        content: "Unlock the Socio-Shark autonomous posting pipeline with your activation code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivatePage,
});

/** Offline/demo escape hatch so the flow is fully clickable without a backend. */
const DEMO_CODE = "424242";

function ActivatePage() {
  const [sessionId, setSessionId] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const navigate = useNavigate();
  const license = useLicenseCheck();

  // Stripe redirects back with ?session_id={CHECKOUT_SESSION_ID} — prefill it
  // so nobody has to retype an id by hand during a live demo.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("session_id");
    if (fromUrl) setSessionId(fromUrl);
  }, []);

  function grant(token: string, message: string) {
    localStorage.setItem(LICENSE_TOKEN_KEY, token);
    license.refresh();
    toast.success(message);
    navigate({ to: "/" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const sid = sessionId.trim();
    const c = code.trim();

    try {
      const res = await fetch("/api/public/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, code: c }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrorMessage(
          data.error === "session_not_paid"
            ? "This checkout session hasn't completed payment yet."
            : data.error === "invalid_code"
              ? "That code doesn't match. Double check and try again."
              : data.error === "code_already_used"
                ? "This activation code has already been used."
                : "Activation failed. Please try again.",
        );
        return;
      }

      grant(data.license_token, "Activated. Welcome aboard.");
    } catch {
      // No backend reachable — allow the demo code so the UI stays usable.
      if (c === DEMO_CODE) {
        grant(`demo_${crypto.randomUUID()}`, "Demo access unlocked.");
        return;
      }
      setStatus("error");
      setErrorMessage("Can't reach the activation service right now. Please try again.");
    }
  }

  if (license.licensed) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-24 text-center">
        <SharkLogo className="h-10 w-10 text-foreground" />
        <h1 className="mt-4 font-mono text-xl font-bold tracking-tight">Already activated</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {license.demo
            ? "You're running on a local demo pass."
            : "Your license is active on this device."}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            onClick={() => navigate({ to: "/" })}
            className="w-full bg-foreground px-4 py-2 font-mono text-sm text-background"
          >
            Go to library
          </button>
          <button
            onClick={() => {
              clearLicense();
              license.refresh();
              toast.message("License cleared from this device.");
            }}
            className="w-full border border-border px-4 py-2 font-mono text-sm hover:bg-muted"
          >
            Clear license
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-1 py-10 sm:py-16">
      <div className="flex items-center gap-2">
        <SharkLogo className="h-8 w-8 shrink-0 text-foreground" />
        <h1 className="font-mono text-xl font-bold tracking-tight">Activate Socio-Shark</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your checkout session ID and the 6-digit code you received after payment.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Checkout session ID
          <input
            type="text"
            placeholder="cs_live_..."
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-foreground"
            autoComplete="off"
            required
          />
        </label>

        <label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          6-digit code
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full border border-border bg-background px-3 py-3 text-center text-lg tracking-[0.4em] text-foreground outline-none focus:border-foreground"
            autoComplete="one-time-code"
            required
          />
        </label>

        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-foreground px-4 py-2.5 font-mono text-sm text-background disabled:opacity-50"
        >
          {status === "loading" ? "Verifying…" : "Activate"}
        </button>

        {status === "error" && (
          <p role="alert" className="border border-border px-3 py-2 text-sm text-foreground">
            {errorMessage}
          </p>
        )}
      </form>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">
          No code yet?{" "}
          <button
            onClick={() => setUpgradeOpen(true)}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {STRIPE_PAYMENT_LINK ? "Buy a license" : "See what's included"}
          </button>
        </p>
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
