import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Vibe } from "@/lib/socio-shared";
import { testKlingAuth } from "@/lib/kling.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: Settings });

interface Slot { id: string; hour: number; minute: number; enabled: boolean; platforms: string[] }

function Settings() {
  const qc = useQueryClient();
  const [brief, setBrief] = useState("");
  useEffect(() => { setBrief(localStorage.getItem("socio-brief") ?? ""); }, []);

  const testKling = useServerFn(testKlingAuth);
  const [testing, setTesting] = useState(false);
  const [klingResult, setKlingResult] = useState<null | {
    ok: boolean; status: number; code: number | null; message: string;
    akPreview: string | null; akLength: number; skLength: number;
  }>(null);

  async function runKlingTest() {
    setTesting(true);
    setKlingResult(null);
    try {
      const r = await testKling({ data: undefined as never });
      setKlingResult(r);
      if (r.ok) toast.success("Kling auth OK");
      else toast.error(`Kling auth failed (HTTP ${r.status})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setKlingResult({ ok: false, status: 0, code: null, message: msg, akPreview: null, akLength: 0, skLength: 0 });
      toast.error(msg);
    } finally { setTesting(false); }
  }

  const { data: slots = [] } = useQuery({
    queryKey: ["slots"],
    queryFn: async () => {
      const { data } = await supabase.from("schedule_slots").select("*").order("hour").order("minute");
      return (data ?? []) as Slot[];
    },
  });
  const { data: vibes = [] } = useQuery({
    queryKey: ["vibes"],
    queryFn: async () => (await supabase.from("vibes").select("*").order("name")).data as Vibe[],
  });

  const [newHour, setNewHour] = useState(12);
  const [newMin, setNewMin] = useState(0);

  async function addSlot() {
    await supabase.from("schedule_slots").insert({ hour: newHour, minute: newMin });
    qc.invalidateQueries({ queryKey: ["slots"] });
    toast.success("Slot added");
  }
  async function delSlot(id: string) {
    await supabase.from("schedule_slots").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["slots"] });
  }
  async function toggleSlot(s: Slot) {
    await supabase.from("schedule_slots").update({ enabled: !s.enabled }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["slots"] });
  }

  function saveBrief() {
    localStorage.setItem("socio-brief", brief);
    toast.success("Brief saved");
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Product brief</h2>
        <p className="text-xs text-muted-foreground">Used by the AI to write captions in your voice.</p>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={8} placeholder="Product name, what it does, who it's for, key selling points, brand tone, CTA…" className="w-full bg-background border border-border px-3 py-2 text-sm font-mono" />
        <button onClick={saveBrief} className="px-4 py-2 bg-foreground text-background text-sm font-mono">Save brief</button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Daily posting times (UTC)</h2>
        <p className="text-xs text-muted-foreground">When auto-scheduling, posts get assigned to the next free slot.</p>
        <div className="border border-border divide-y divide-border">
          {slots.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <span className="font-mono text-lg w-20">{String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")}</span>
              <span className="text-xs font-mono text-muted-foreground flex-1">{s.platforms.join(" · ")}</span>
              <button onClick={() => toggleSlot(s)} className={`px-2 py-1 text-[10px] font-mono ${s.enabled ? "bg-foreground text-background" : "border border-border"}`}>
                {s.enabled ? "ON" : "OFF"}
              </button>
              <button onClick={() => delSlot(s.id)} className="px-2 py-1 text-[10px] font-mono border border-border hover:bg-destructive hover:text-destructive-foreground">DEL</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div><label className="text-[10px] font-mono uppercase text-muted-foreground block">Hour</label>
            <input type="number" min={0} max={23} value={newHour} onChange={(e) => setNewHour(+e.target.value)} className="bg-background border border-border w-20 px-2 py-1 text-sm font-mono" />
          </div>
          <div><label className="text-[10px] font-mono uppercase text-muted-foreground block">Min</label>
            <input type="number" min={0} max={59} value={newMin} onChange={(e) => setNewMin(+e.target.value)} className="bg-background border border-border w-20 px-2 py-1 text-sm font-mono" />
          </div>
          <button onClick={addSlot} className="px-3 py-1.5 border border-border text-sm font-mono">+ Add slot</button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Vibes</h2>
        <p className="text-xs text-muted-foreground">Visual + tone presets used when generating captions.</p>
        <div className="border border-border divide-y divide-border">
          {vibes.map((v) => (
            <div key={v.id} className="p-3">
              <p className="font-bold text-sm">{v.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5"><span className="font-mono uppercase mr-2">style:</span>{v.prompt_style}</p>
              <p className="text-xs text-muted-foreground mt-0.5"><span className="font-mono uppercase mr-2">tone:</span>{v.caption_tone}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">API tokens</h2>
        <p className="text-xs text-muted-foreground">Stored as encrypted Lovable Cloud secrets. Tell Socio-Shark to add them when you're ready:</p>
        <ul className="text-xs font-mono space-y-1 border border-border p-3">
          <li>KLING_ACCESS_KEY <span className="text-muted-foreground">— from klingai.com → API</span></li>
          <li>KLING_SECRET_KEY <span className="text-muted-foreground">— pairs with the access key for JWT auth</span></li>
          <li>META_ACCESS_TOKEN <span className="text-muted-foreground">— Meta Graph API token (for Instagram Reels)</span></li>
          <li>INSTAGRAM_ACCOUNT_ID <span className="text-muted-foreground">— your IG Professional account id</span></li>
          <li>TIKTOK_ACCESS_TOKEN <span className="text-muted-foreground">— TikTok Content Posting API token</span></li>
        </ul>

        <div className="space-y-2 pt-2">
          <button
            onClick={runKlingTest}
            disabled={testing}
            className="px-4 py-2 bg-foreground text-background text-sm font-mono disabled:opacity-40"
          >
            {testing ? "Testing…" : "Test Kling API"}
          </button>
          {klingResult && (
            <div className={`border p-3 text-xs font-mono space-y-1 ${klingResult.ok ? "border-foreground" : "border-destructive"}`}>
              <p className={klingResult.ok ? "" : "text-destructive"}>
                {klingResult.ok ? "✓ OK" : "✗ FAILED"} · HTTP {klingResult.status}
                {klingResult.code !== null && ` · code ${klingResult.code}`}
              </p>
              <p className="text-muted-foreground break-words">{klingResult.message}</p>
              <p className="text-muted-foreground">
                AK: {klingResult.akPreview ?? "—"} · SK length: {klingResult.skLength}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
