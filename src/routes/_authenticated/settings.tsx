import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { testProvider } from "@/lib/providers.functions";
import { saveSecret, listSecretKeys, deleteSecret } from "@/lib/secrets.functions";
import { PROVIDERS, type ProviderTestResult } from "@/lib/providers/registry";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

interface Slot { id: string; hour: number; minute: number; enabled: boolean; platforms: string[] }

function Settings() {
  const qc = useQueryClient();
  const testFn = useServerFn(testProvider);
  const saveFn = useServerFn(saveSecret);
  const deleteFn = useServerFn(deleteSecret);
  const listFn = useServerFn(listSecretKeys);

  // Per-provider verification results (from the Test button or a save)
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});

  // Secret input states
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: savedKeys = [] } = useQuery({
    queryKey: ["secret-keys"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const isSet = (key: string) => savedKeys.some((s) => s.key === key);

  const providerLabel = (providerId: string) =>
    PROVIDERS.find((p) => p.id === providerId)?.label ?? providerId;

  async function handleSaveSecret(key: string) {
    const value = secretInputs[key]?.trim();
    if (!value) { toast.error("Value cannot be empty"); return; }
    setSavingKey(key);
    try {
      const r = await saveFn({ data: { key, value } });
      setSecretInputs((prev) => ({ ...prev, [key]: "" }));
      qc.invalidateQueries({ queryKey: ["secret-keys"] });
      if (r.test) {
        // Saved + verified automatically — surface a bad paste immediately.
        setTestResults((prev) => ({ ...prev, [r.test!.providerId]: r.test! }));
        if (r.test.ok) toast.success(`${key} saved — verified ✓`);
        else toast.warning(`${key} saved, but verification failed: ${r.test.message}`);
      } else {
        toast.success(`${key} saved`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSavingKey(null); }
  }

  async function handleDeleteSecret(key: string) {
    if (!confirm(`Remove ${key}?`)) return;
    try {
      await deleteFn({ data: { key } });
      toast.success(`${key} removed`);
      qc.invalidateQueries({ queryKey: ["secret-keys"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function runProviderTest(providerId: string) {
    setTestingId(providerId);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    try {
      const r = await testFn({ data: { providerId } });
      setTestResults((prev) => ({ ...prev, [providerId]: r }));
      if (r.ok) toast.success(`${providerLabel(providerId)} auth OK`);
      else toast.error(`${providerLabel(providerId)} auth failed: ${r.message}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTestResults((prev) => ({
        ...prev,
        [providerId]: { providerId, ok: false, status: 0, message: msg },
      }));
      toast.error(msg);
    } finally { setTestingId(null); }
  }

  const { data: slots = [] } = useQuery({
    queryKey: ["slots"],
    queryFn: async () => {
      const { data } = await supabase.from("schedule_slots").select("*").order("hour").order("minute");
      return (data ?? []) as Slot[];
    },
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

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

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
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">API tokens</h2>
        <p className="text-xs text-muted-foreground">
          Stored server-side only — the browser never sees the values. Fields below are generated from the
          provider registry, so every key the backend needs always has a home here.
        </p>
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const result = testResults[provider.id];
            return (
              <div key={provider.id} className="border border-border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono font-bold">{provider.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{provider.hint}</p>
                  </div>
                  <button
                    onClick={() => runProviderTest(provider.id)}
                    disabled={testingId !== null}
                    className="px-3 py-1.5 border border-border text-xs font-mono hover:bg-accent shrink-0 disabled:opacity-40"
                  >
                    {testingId === provider.id ? "Testing…" : provider.testLabel}
                  </button>
                </div>

                <div className="space-y-2">
                  {provider.keys.map(({ key, label, hint }) => (
                    <div key={key} className="border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono font-bold">{label}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{hint}</p>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-1 border ${isSet(key) ? "border-green-700 text-green-500" : "border-border text-muted-foreground"}`}>
                          {isSet(key) ? "✓ SET" : "NOT SET"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder={isSet(key) ? "Enter new value to update…" : "Paste value here…"}
                          value={secretInputs[key] ?? ""}
                          onChange={(e) => setSecretInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 bg-background border border-border px-3 py-1.5 text-sm font-mono"
                        />
                        <button
                          onClick={() => handleSaveSecret(key)}
                          disabled={savingKey === key || !secretInputs[key]?.trim()}
                          className="px-3 py-1.5 bg-foreground text-background text-xs font-mono disabled:opacity-40"
                        >
                          {savingKey === key ? "Saving…" : "Save"}
                        </button>
                        {isSet(key) && (
                          <button
                            onClick={() => handleDeleteSecret(key)}
                            className="px-3 py-1.5 border border-border text-xs font-mono hover:bg-destructive hover:text-destructive-foreground"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {result && (
                  <div className={`border p-3 text-xs font-mono space-y-1 ${result.ok ? "border-foreground" : "border-destructive"}`}>
                    <p className={result.ok ? "" : "text-destructive"}>
                      {result.ok ? "✓ OK" : "✗ FAILED"}
                      {typeof result.status === "number" && result.status > 0 && ` · HTTP ${result.status}`}
                    </p>
                    <p className="text-muted-foreground break-words">{result.message}</p>
                    {result.detail && <p className="text-muted-foreground">{result.detail}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
