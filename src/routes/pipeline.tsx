import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { runContentPipeline, runBatchPipeline, listPipelinePrompts } from "@/lib/content-pipeline.functions";
import { supabase } from "@/integrations/supabase/client";
import { Vibe } from "@/lib/socio-shared";
import { toast } from "sonner";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

function PipelinePage() {
  const qc = useQueryClient();
  const runFn = useServerFn(runContentPipeline);
  const batchFn = useServerFn(runBatchPipeline);
  const listFn = useServerFn(listPipelinePrompts);

  const [promptOverride, setPromptOverride] = useState("");
  const [hashtags, setHashtags] = useState("#BlackFish #BlackFishCorp");
  const [vibeId, setVibeId] = useState("");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [batchCount, setBatchCount] = useState(3);
  const [skipKling, setSkipKling] = useState(false);
  const [busy, setBusy] = useState<"single" | "batch" | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [batchResults, setBatchResults] = useState<unknown[]>([]);

  const { data: vibes = [] } = useQuery({
    queryKey: ["vibes"],
    queryFn: async () => (await supabase.from("vibes").select("*").order("name")).data as Vibe[],
  });

  const { data: savedPrompts = [] } = useQuery({
    queryKey: ["pipeline-prompts"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const { data: productCount } = useQuery({
    queryKey: ["product-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  async function runSingle() {
    setBusy("single");
    setLastResult(null);
    try {
      const r = await runFn({
        data: {
          promptOverride: promptOverride || undefined,
          hashtags,
          vibeId: vibeId || undefined,
          duration,
          skipKling,
        },
      });
      setLastResult(r as Record<string, unknown>);
      toast.success(r.klingTaskId ? "Pipeline ran — video generating" : skipKling ? "Test run complete" : `Error: ${r.klingError}`);
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function runBatch() {
    setBusy("batch");
    setBatchResults([]);
    try {
      const r = await batchFn({ data: { count: batchCount, hashtags, skipKling } });
      setBatchResults(r.results);
      toast.success(`Batch complete — ${r.completed} posts created`);
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Content Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Random product image → Claude caption → Kling video → Draft post. Fully automated.
        </p>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Products loaded</p>
          <p className="text-2xl font-bold mt-1">{productCount ?? "—"}</p>
        </div>
        <div className="border border-border p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Saved prompts</p>
          <p className="text-2xl font-bold mt-1">{savedPrompts.length}</p>
        </div>
        <div className="border border-border p-3">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Kling mode</p>
          <p className="text-2xl font-bold mt-1">{skipKling ? "TEST" : "LIVE"}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="border border-border p-5 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Pipeline config</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Hashtags</label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Vibe (optional)</label>
            <select
              value={vibeId}
              onChange={(e) => setVibeId(e.target.value)}
              className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono"
            >
              <option value="">Random</option>
              {vibes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(+e.target.value as 5 | 10)}
              className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono"
            >
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-mono pb-1.5">
              <input
                type="checkbox"
                checked={skipKling}
                onChange={(e) => setSkipKling(e.target.checked)}
                className="accent-foreground"
              />
              Test mode (skip Kling)
            </label>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase block mb-1">
            Prompt override (leave blank for random)
          </label>
          <textarea
            value={promptOverride}
            onChange={(e) => setPromptOverride(e.target.value)}
            placeholder="e.g. Animate this picture. Add the watermark logo to the video."
            rows={2}
            className="w-full bg-background border border-border px-3 py-1.5 text-sm font-mono resize-y"
          />
        </div>
      </div>

      {/* Saved prompts quick view */}
      {savedPrompts.length > 0 && (
        <div className="border border-border p-4 space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Prompt pool ({savedPrompts.length}) — pipeline picks randomly from these
          </h2>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {savedPrompts.map((p: { id: string; title: string; prompt: string }) => (
              <div key={p.id} className="flex gap-3 items-start border-b border-border pb-1">
                <span className="text-[10px] font-mono font-bold text-muted-foreground w-28 shrink-0 truncate">{p.title}</span>
                <span
                  className="text-[10px] font-mono text-muted-foreground flex-1 line-clamp-1 cursor-pointer hover:text-foreground"
                  onClick={() => setPromptOverride(p.prompt)}
                  title="Click to use this prompt"
                >
                  {p.prompt}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Click a prompt to load it as override</p>
        </div>
      )}

      {/* Run buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <button
            onClick={runSingle}
            disabled={busy !== null}
            className="w-full py-3 bg-foreground text-background text-sm font-mono disabled:opacity-40"
          >
            {busy === "single" ? "Running…" : "▶ Run Pipeline Once"}
          </button>
          <p className="text-[10px] font-mono text-muted-foreground text-center">
            1 random image → caption → Kling
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={10}
              value={batchCount}
              onChange={(e) => setBatchCount(+e.target.value)}
              className="w-16 bg-background border border-border px-2 py-3 text-sm font-mono text-center"
            />
            <button
              onClick={runBatch}
              disabled={busy !== null}
              className="flex-1 py-3 border border-foreground text-foreground text-sm font-mono disabled:opacity-40"
            >
              {busy === "batch" ? `Running ${batchCount}…` : `⚡ Run Batch (${batchCount})`}
            </button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground text-center">
            Max 10 per batch · cap per Kling limits
          </p>
        </div>
      </div>

      {/* Last single result */}
      {lastResult && (
        <div className="border border-border p-4 space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Last run</h2>
          <div className="space-y-1 text-xs font-mono">
            <p><span className="text-muted-foreground">Image: </span>{String(lastResult.imageUsed)}</p>
            <p><span className="text-muted-foreground">Prompt: </span>{String(lastResult.promptUsed)}</p>
            <p><span className="text-muted-foreground">Caption: </span>{String(lastResult.caption)}</p>
            <p>
              <span className="text-muted-foreground">Status: </span>
              <span className={lastResult.klingTaskId ? "text-green-500" : lastResult.klingError ? "text-red-500" : ""}>
                {lastResult.klingTaskId ? `Generating — task ${String(lastResult.klingTaskId).slice(0, 12)}…` : lastResult.klingError ? String(lastResult.klingError) : String(lastResult.status)}
              </span>
            </p>
            {lastResult.postId ? (
              <Link to="/queue" className="underline text-foreground">View in queue →</Link>
            ) : null}
          </div>
        </div>
      )}

      {/* Batch results */}
      {batchResults.length > 0 && (
        <div className="border border-border p-4 space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Batch results ({batchResults.length})
          </h2>
          <div className="divide-y divide-border">
            {(batchResults as Array<{ index: number; image?: string; klingTaskId?: string; klingError?: string; error?: string }>).map((r, i) => (
              <div key={i} className="py-2 text-xs font-mono flex gap-3">
                <span className="text-muted-foreground w-6">{r.index}.</span>
                <span className="flex-1 truncate">{r.image ?? r.error ?? "—"}</span>
                <span className={r.klingTaskId ? "text-green-500" : "text-red-500"}>
                  {r.klingTaskId ? "✓ queued" : r.klingError ?? r.error ?? "skipped"}
                </span>
              </div>
            ))}
          </div>
          <Link to="/queue" className="text-xs font-mono underline">View all in queue →</Link>
        </div>
      )}
    </div>
  );
}
