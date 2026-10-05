import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateIndustryStrategy, getBusinessProfile, saveBusinessProfile } from "@/lib/marketing.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({ component: BusinessOnboarding });
type Profile = { business_name: string; industry: string; target_audience: string; primary_offer: string; brand_voice: string; workflow_notes: string; strategy: string };
const empty: Profile = { business_name: "", industry: "", target_audience: "", primary_offer: "", brand_voice: "", workflow_notes: "", strategy: "" };
const industries = ["Food and restaurants", "Retail and ecommerce", "Beauty and wellness", "Professional services", "Real estate", "Fitness and health", "Education", "Travel and hospitality", "Nonprofit", "Creator and entertainment", "Other"];

function BusinessOnboarding() {
  const getProfile = useServerFn(getBusinessProfile); const saveProfile = useServerFn(saveBusinessProfile); const generateStrategy = useServerFn(generateIndustryStrategy);
  const [form, setForm] = useState<Profile>(empty); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { let alive = true; void (async () => {
    const { data } = await supabase.auth.getUser(); if (!alive) return;
    if (!data.user) { window.location.assign("/auth"); return; }
    setSignedIn(true);
    try { const profile = await getProfile({ data: undefined as never }); if (profile) setForm({ ...empty, ...profile }); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not load profile."); }
    finally { if (alive) setLoading(false); }
  })(); return () => { alive = false; }; }, []);
  function change(key: keyof Profile, value: string) { setForm((old) => ({ ...old, [key]: value })); }
  async function save(andGenerate: boolean) {
    if (!form.industry.trim()) { toast.error("Choose an industry first"); return; }
    setBusy(true); setMessage("");
    try { await saveProfile({ data: form }); if (andGenerate) { const result = await generateStrategy({ data: undefined as never }); setForm((old) => ({ ...old, strategy: result.strategy })); toast.success("Strategy ready to review and edit"); } else toast.success("Business profile saved"); }
    catch (e) { const text = e instanceof Error ? e.message : "Could not save profile."; setMessage(text); toast.error(text); }
    finally { setBusy(false); }
  }
  const field = (key: keyof Profile, label: string, placeholder: string, rows = 1) => <label className="block space-y-1"><span className="text-xs font-mono uppercase text-muted-foreground">{label}</span>{rows === 1 ? <input value={form[key]} onChange={(e) => change(key, e.target.value)} placeholder={placeholder} className="w-full border border-border bg-background px-3 py-2 text-sm" /> : <textarea rows={rows} value={form[key]} onChange={(e) => change(key, e.target.value)} placeholder={placeholder} className="w-full border border-border bg-background px-3 py-2 text-sm" />}</label>;
  if (loading || !signedIn) return <main className="max-w-3xl mx-auto p-8 text-sm text-muted-foreground">Loading your business profile…</main>;
  return <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
    <header><p className="text-xs font-mono text-muted-foreground">SOCIO-SHARK / BUSINESS SETUP</p><h1 className="text-3xl font-bold mt-2">Make your strategy fit your business</h1><p className="text-sm text-muted-foreground mt-2">Tell us about your industry, audience, brand voice, and workflow. Gemini uses this context for an industry-tailored strategy and editable captions.</p></header>
    {message && <div className="border border-destructive p-3 text-sm">{message}</div>}
    <section className="space-y-4 border border-border p-5">
      {field("business_name", "Business name", "e.g. Northside Pilates")}
      <label className="block space-y-1"><span className="text-xs font-mono uppercase text-muted-foreground">Industry *</span><select required value={form.industry} onChange={(e) => change("industry", e.target.value)} className="w-full border border-border bg-background px-3 py-2 text-sm"><option value="">Choose your industry</option>{industries.map((i) => <option key={i}>{i}</option>)}</select></label>
      {field("target_audience", "Who do you serve?", "Describe your ideal customers", 2)}{field("primary_offer", "Main offer", "Products, services, or offers to mention", 2)}{field("brand_voice", "Brand voice", "e.g. warm, expert, playful, concise", 2)}{field("workflow_notes", "Your marketing workflow", "Approval steps, posting cadence, preferred calls to action, platforms, and do/don't preferences", 3)}
      <div className="flex gap-3 flex-wrap"><button onClick={() => save(false)} disabled={busy} className="px-4 py-2 border border-border text-sm disabled:opacity-50">{busy ? "Saving…" : "Save profile"}</button><button onClick={() => save(true)} disabled={busy} className="px-4 py-2 bg-foreground text-background text-sm disabled:opacity-50">{busy ? "Working…" : "Save and create my strategy"}</button></div>
    </section>
    {form.strategy && <section className="space-y-3 border border-border p-5"><h2 className="text-xl font-semibold">Your industry-tailored strategy</h2><textarea value={form.strategy} onChange={(e) => change("strategy", e.target.value)} rows={18} className="w-full border border-border bg-background px-3 py-2 text-sm font-mono"/><button onClick={() => save(false)} disabled={busy} className="px-4 py-2 border border-border text-sm">Save profile and strategy</button><button onClick={() => save(true)} disabled={busy} className="ml-3 px-4 py-2 border border-border text-sm">Regenerate strategy</button></section>}
    <footer className="flex justify-between items-center border-t border-border pt-5 text-sm"><Link to="/auth" className="underline">Sign in with another account</Link><Link to="/billing" className="px-4 py-2 bg-foreground text-background">Continue to plans</Link></footer>
  </main>;
}
