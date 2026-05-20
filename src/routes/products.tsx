import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Vibe } from "@/lib/socio-shared";
import { startKlingGeneration, pollKlingPost } from "@/lib/kling.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({ component: ProductsPage });

interface Product {
  id: string;
  created_at: string;
  image_path: string;
  name: string | null;
  videos_generated: number;
}

function imgUrl(path: string) {
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function ProductsPage() {
  const qc = useQueryClient();
  const startFn = useServerFn(startKlingGeneration);
  const pollFn = useServerFn(pollKlingPost);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [vibeId, setVibeId] = useState<string>("");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [savingTitle, setSavingTitle] = useState("");
  const [activePromptId, setActivePromptId] = useState<string | null>(null);

  interface SavedPrompt {
    id: string; title: string; prompt: string; vibe_id: string | null;
    duration: number; use_count: number; last_used_at: string | null;
  }

  const { data: savedPrompts = [] } = useQuery({
    queryKey: ["saved_prompts"],
    queryFn: async () => {
      const { data } = await supabase.from("saved_prompts").select("*")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      return (data ?? []) as SavedPrompt[];
    },
  });

  async function savePrompt() {
    const title = savingTitle.trim();
    if (!title) { toast.error("Give it a title"); return; }
    if (!extraPrompt.trim()) { toast.error("Prompt is empty"); return; }
    const { error } = await supabase.from("saved_prompts").insert({
      title, prompt: extraPrompt.trim(), vibe_id: vibeId || null, duration,
    });
    if (error) { toast.error(error.message); return; }
    setSavingTitle("");
    qc.invalidateQueries({ queryKey: ["saved_prompts"] });
    toast.success("Prompt saved");
  }

  async function updateActivePrompt() {
    if (!activePromptId) return;
    const { error } = await supabase.from("saved_prompts").update({
      prompt: extraPrompt.trim(), vibe_id: vibeId || null, duration,
    }).eq("id", activePromptId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["saved_prompts"] });
    toast.success("Prompt updated");
  }

  function loadPrompt(p: SavedPrompt) {
    setExtraPrompt(p.prompt);
    setVibeId(p.vibe_id ?? "");
    setDuration((p.duration === 10 ? 10 : 5) as 5 | 10);
    setActivePromptId(p.id);
    toast.success(`Loaded "${p.title}"`);
  }

  async function deletePrompt(id: string) {
    if (!confirm("Delete this saved prompt?")) return;
    await supabase.from("saved_prompts").delete().eq("id", id);
    if (activePromptId === id) setActivePromptId(null);
    qc.invalidateQueries({ queryKey: ["saved_prompts"] });
  }

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: vibes = [] } = useQuery({
    queryKey: ["vibes"],
    queryFn: async () => (await supabase.from("vibes").select("*").order("name")).data as Vibe[],
  });

  // Poll any in-flight generations every 8s
  const { data: pendingPosts = [] } = useQuery({
    queryKey: ["posts", "generating"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("id,kling_task_id,generation_status").eq("generation_status", "generating");
      return data ?? [];
    },
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!pendingPosts.length) return;
    pendingPosts.forEach(async (p) => {
      try {
        const r = await pollFn({ data: { postId: p.id } });
        if (r.status === "ready") { toast.success("Video ready"); qc.invalidateQueries(); }
        if (r.status === "failed") { toast.error(`Generation failed: ${r.error}`); qc.invalidateQueries(); }
      } catch { /* keep polling */ }
    });
  }, [pendingPosts, pollFn, qc]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(files.length);
    let done = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (up.error) { toast.error(`Upload failed: ${file.name}`); continue; }
      await supabase.from("products").insert({ image_path: path, name: file.name });
      done++;
      setUploading(files.length - done);
    }
    setUploading(0);
    if (inputRef.current) inputRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(`Uploaded ${done} image${done === 1 ? "" : "s"}`);
  }

  async function onZip(file: File | null) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) { toast.error("Pick a .zip file"); return; }
    toast.info("Extracting ZIP…");
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(
      (f) => !f.dir && /\.(jpe?g|png|webp)$/i.test(f.name),
    );
    if (!entries.length) { toast.error("No images found in ZIP"); return; }
    setUploading(entries.length);
    let done = 0;
    for (const entry of entries) {
      const blob = await entry.async("blob");
      const ext = entry.name.split(".").pop()!.toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("product-images").upload(path, blob, { contentType: mime });
      if (up.error) { console.error(up.error); continue; }
      await supabase.from("products").insert({ image_path: path, name: entry.name.split("/").pop() ?? entry.name });
      done++;
      setUploading(entries.length - done);
    }
    setUploading(0);
    qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(`Imported ${done} image${done === 1 ? "" : "s"} from ZIP`);
  }

  async function generate(p: Product) {
    setBusy(p.id);
    try {
      const r = await startFn({ data: { productId: p.id, vibeId: vibeId || undefined, prompt: extraPrompt || undefined, duration } });
      setGenerating((s) => new Set(s).add(r.postId));
      if (activePromptId) {
        const sp = savedPrompts.find((x) => x.id === activePromptId);
        await supabase.from("saved_prompts").update({
          use_count: (sp?.use_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        }).eq("id", activePromptId);
        qc.invalidateQueries({ queryKey: ["saved_prompts"] });
      }
      toast.success("Generation started — check back in ~1–3 min");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  async function deleteProduct(p: Product) {
    if (!confirm("Delete this product image?")) return;
    await supabase.storage.from("product-images").remove([p.image_path]);
    await supabase.from("products").delete().eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload product photos in bulk. Generate Kling videos from each — they land as drafts in the Review Queue.
        </p>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed border-border p-8 text-center"
      >
        <input ref={inputRef} type="file" multiple accept="image/*" onChange={(e) => onFiles(e.target.files)} className="hidden" id="prod-up" />
        <input type="file" accept=".zip,application/zip" onChange={(e) => onZip(e.target.files?.[0] ?? null)} className="hidden" id="prod-zip" />
        <div className="flex gap-2 justify-center flex-wrap">
          <label htmlFor="prod-up" className="cursor-pointer inline-block px-4 py-2 bg-foreground text-background text-sm font-mono">
            {uploading ? `Uploading ${uploading}…` : "Upload images"}
          </label>
          <label htmlFor="prod-zip" className="cursor-pointer inline-block px-4 py-2 border border-border text-sm font-mono hover:bg-foreground hover:text-background">
            Import ZIP
          </label>
        </div>
        <p className="text-xs font-mono text-muted-foreground mt-3">or drag & drop · JPG/PNG/WEBP · ZIP imports all images at root</p>
      </div>

      {/* Generation controls */}
      <div className="border border-border p-4 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Generation defaults</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Vibe</label>
            <select value={vibeId} onChange={(e) => setVibeId(e.target.value)} className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono">
              <option value="">Random</option>
              {vibes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Duration</label>
            <select value={duration} onChange={(e) => setDuration(+e.target.value as 5 | 10)} className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono">
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase block mb-1">Prompt</label>
            <textarea value={extraPrompt} onChange={(e) => { setExtraPrompt(e.target.value); }} placeholder="e.g. slow zoom, golden hour, cinematic"
              rows={2} className="w-full bg-background border border-border px-2 py-1.5 text-sm font-mono resize-y" />
          </div>
        </div>

        {/* Save / update prompt row */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
          <input value={savingTitle} onChange={(e) => setSavingTitle(e.target.value)} placeholder="Title to save current prompt as…"
            className="flex-1 min-w-[180px] bg-background border border-border px-2 py-1.5 text-xs font-mono" />
          <button onClick={savePrompt} className="px-3 py-1.5 text-[11px] font-mono border border-border hover:bg-foreground hover:text-background">+ Save prompt</button>
          {activePromptId && (
            <>
              <span className="text-[10px] font-mono text-muted-foreground">editing: {savedPrompts.find(p => p.id === activePromptId)?.title}</span>
              <button onClick={updateActivePrompt} className="px-3 py-1.5 text-[11px] font-mono bg-foreground text-background">Update</button>
              <button onClick={() => setActivePromptId(null)} className="px-2 py-1.5 text-[10px] font-mono border border-border">Clear</button>
            </>
          )}
        </div>
      </div>

      {/* Saved prompts library */}
      {savedPrompts.length > 0 && (
        <div className="border border-border p-4 space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Saved prompts ({savedPrompts.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {savedPrompts.map((sp) => {
              const vibeName = vibes.find((v) => v.id === sp.vibe_id)?.name;
              const isActive = sp.id === activePromptId;
              return (
                <div key={sp.id} className={`border p-2 space-y-1 ${isActive ? "border-foreground" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold flex-1 truncate">{sp.title}</p>
                    <span className="text-[9px] font-mono text-muted-foreground">{sp.use_count}×</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground line-clamp-2">{sp.prompt}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    {sp.duration}s · {vibeName ?? "random vibe"}
                  </p>
                  <div className="flex gap-1 pt-1">
                    <button onClick={() => loadPrompt(sp)} className="flex-1 text-[10px] font-mono py-1 bg-foreground text-background">Load</button>
                    <button onClick={() => deletePrompt(sp.id)} className="px-2 text-[10px] font-mono border border-border hover:bg-destructive hover:text-destructive-foreground">Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet. Upload some images above.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
            <div key={p.id} className="border border-border bg-card">
              <div className="aspect-square bg-muted overflow-hidden">
                <img src={imgUrl(p.image_path)} alt={p.name ?? ""} className="w-full h-full object-cover" />
              </div>
              <div className="p-2 space-y-2">
                <p className="text-[11px] font-mono truncate" title={p.name ?? ""}>{p.name ?? "—"}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{p.videos_generated} video{p.videos_generated === 1 ? "" : "s"} generated</p>
                <button
                  onClick={() => generate(p)}
                  disabled={busy === p.id}
                  className="w-full text-[11px] font-mono py-1.5 bg-foreground text-background disabled:opacity-40"
                >
                  {busy === p.id ? "Starting…" : "Generate AI Video"}
                </button>
                <button onClick={() => deleteProduct(p)} className="w-full text-[10px] font-mono py-1 border border-border hover:bg-destructive hover:text-destructive-foreground">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingPosts.length > 0 && (
        <div className="border border-border p-3 text-xs font-mono">
          <span className="text-muted-foreground">In progress: </span>
          {pendingPosts.length} video{pendingPosts.length === 1 ? "" : "s"} generating · auto-refreshing
          <Link to="/queue" className="ml-3 underline">View queue →</Link>
        </div>
      )}
    </div>
  );
}
