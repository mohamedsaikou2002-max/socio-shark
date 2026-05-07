import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Vibe } from "@/lib/socio-shared";
import { toast } from "sonner";

export const Route = createFileRoute("/upload")({ component: UploadPage });

interface PendingFile {
  file: File;
  vibeId: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [defaultVibe, setDefaultVibe] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: vibes = [] } = useQuery({
    queryKey: ["vibes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vibes").select("*").order("name");
      if (error) throw error;
      if (data?.[0]) setDefaultVibe((v) => v || data[0].id);
      return data as Vibe[];
    },
  });

  function addFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("video/"));
    setPending((p) => [...p, ...arr.map((file) => ({ file, vibeId: defaultVibe || (vibes[0]?.id ?? ""), status: "queued" as const, progress: 0 }))]);
  }

  async function uploadAll() {
    if (!pending.length) return;
    setBusy(true);
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      if (item.status === "done") continue;
      setPending((p) => p.map((x, idx) => idx === i ? { ...x, status: "uploading", progress: 10 } : x));
      try {
        const ext = item.file.name.split(".").pop() || "mp4";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("videos").upload(path, item.file, {
          contentType: item.file.type,
        });
        if (upErr) throw upErr;
        const vibe = vibes.find((v) => v.id === item.vibeId);
        const { error: insErr } = await supabase.from("posts").insert({
          video_path: path,
          vibe_id: item.vibeId || null,
          vibe_name: vibe?.name ?? null,
          status: "draft",
        });
        if (insErr) throw insErr;
        setPending((p) => p.map((x, idx) => idx === i ? { ...x, status: "done", progress: 100 } : x));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setPending((p) => p.map((x, idx) => idx === i ? { ...x, status: "error", error: msg } : x));
      }
    }
    setBusy(false);
    toast.success("Uploads complete");
    setTimeout(() => navigate({ to: "/queue" }), 600);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Upload videos</h1>
        <p className="text-sm text-muted-foreground mt-1">Drop as many as you want. They'll land in the review queue with auto-generated captions.</p>
      </div>

      <label
        className="border-2 border-dashed border-border block p-10 text-center cursor-pointer hover:bg-muted transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <p className="font-mono text-sm">Drop videos here, or click to choose</p>
        <p className="text-xs text-muted-foreground mt-1">.mp4 / .mov · vertical 9:16 recommended</p>
      </label>

      <div className="flex items-center gap-3">
        <label className="text-xs font-mono uppercase text-muted-foreground">Default vibe:</label>
        <select value={defaultVibe} onChange={(e) => setDefaultVibe(e.target.value)} className="bg-background border border-border px-3 py-1.5 text-sm">
          {vibes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {pending.length > 0 && (
        <div className="border border-border divide-y divide-border">
          {pending.map((p, i) => (
            <div key={i} className="p-3 flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase w-16 text-muted-foreground">{p.status}</span>
              <span className="text-sm flex-1 truncate">{p.file.name}</span>
              <select value={p.vibeId} onChange={(e) => setPending((arr) => arr.map((x, idx) => idx === i ? { ...x, vibeId: e.target.value } : x))} className="bg-background border border-border px-2 py-1 text-xs">
                {vibes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <span className="text-xs text-muted-foreground w-12 text-right">{(p.file.size / 1024 / 1024).toFixed(1)}MB</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={uploadAll} disabled={!pending.length || busy} className="px-4 py-2 bg-foreground text-background text-sm font-mono disabled:opacity-40">
          {busy ? "Uploading…" : `Upload ${pending.length} video${pending.length === 1 ? "" : "s"}`}
        </button>
        <button onClick={() => setPending([])} disabled={busy} className="px-4 py-2 border border-border text-sm font-mono">Clear</button>
      </div>
    </div>
  );
}
