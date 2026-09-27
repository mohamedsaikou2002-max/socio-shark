import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/activate")({
  head: () => ({ meta: [
    { title: "Enter access code — Socio-Shark" },
    { name: "description", content: "Redeem a seven-digit Socio-Shark client access code." },
    { property: "og:title", content: "Enter access code — Socio-Shark" },
    { property: "og:description", content: "Redeem a seven-digit Socio-Shark client access code." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: ActivatePage,
});

function ActivatePage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  function submit(event: React.FormEvent) { event.preventDefault(); setMessage(code.length === 7 ? "This code is ready to verify when client-code service is connected." : "Enter the full seven-digit code."); }
  return <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><div className="w-full max-w-md border border-border p-6 sm:p-8"><KeyRound className="h-7 w-7" /><p className="mt-6 font-mono text-xs uppercase text-muted-foreground">Client access</p><h1 className="mt-2 text-2xl font-bold">Enter your access code</h1><p className="mt-2 text-sm text-muted-foreground">Use the seven-digit code supplied with your client plan.</p><form onSubmit={submit} className="mt-6 space-y-3"><input inputMode="numeric" autoComplete="one-time-code" aria-label="Seven-digit access code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="0000000" className="h-14 w-full border border-input bg-background px-4 text-center font-mono text-2xl tracking-[0.35em]" /><Button className="w-full" disabled={code.length !== 7}>Verify code</Button></form>{message && <p className="mt-4 border border-border p-3 text-sm text-muted-foreground">{message}</p>}<Button asChild variant="link" className="mt-3 w-full"><Link to="/auth">Back to sign in</Link></Button></div></div>;
}