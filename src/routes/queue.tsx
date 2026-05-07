import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post, Vibe } from "@/lib/socio-shared";
import { PostCard } from "@/components/PostCard";
import { generateCaptions, autoSchedule } from "@/lib/socio.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/queue")({ component: QueuePage });

function QueuePage() {
  const qc = useQueryClient();
  const genFn = useServerFn(generateCaptions);
  const schedFn = useServerFn(autoSchedule);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", "draft"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("status", "draft").order("created_at");
      if (error) throw error;
      return data as Post[];
    },
  });

  const { data: vibes = [] } = useQuery({
    queryKey: ["vibes"],
    queryFn: async () => (await supabase.from("vibes").select("*")).data as Vibe[],
  });

  const { data: brief } = useQuery({
    queryKey: ["brief"],
    queryFn: async () => {
      const k = "socio-brief";
      return localStorage.getItem(k) ?? "";
    },
  });

  async function genFor(post: Post) {
    const vibe = vibes.find((v) => v.id === post.vibe_id) ?? vibes[0];
    if (!vibe) { toast.error("No vibe configured"); return; }
    setBusy(post.id);
    try {
      const r = await genFn({ data: { vibe: { name: vibe.name, prompt_style: vibe.prompt_style, caption_tone: vibe.caption_tone }, brief: brief ?? "" } });
      await supabase.from("posts").update({ caption_tiktok: r.tiktok, caption_instagram: r.instagram }).eq("id", post.id);
      toast.success("Captions generated");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(null); }
  }

  async function genAll() {
    for (const p of posts.filter((x) => !x.caption_tiktok)) await genFor(p);
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function scheduleSelected() {
    const ids = Array.from(selected);
    if (!ids.length) return toast.error("Select at least one post");
    try {
      const r = await schedFn({ data: { postIds: ids } });
      toast.success(`Scheduled ${r.scheduled.length} post${r.scheduled.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Review queue</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate captions, then schedule into your daily slots.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={genAll} disabled={!posts.length} className="px-3 py-2 border border-border text-sm font-mono disabled:opacity-40">Generate all captions</button>
          <button onClick={scheduleSelected} disabled={!selected.size} className="px-3 py-2 bg-foreground text-background text-sm font-mono disabled:opacity-40">
            Schedule {selected.size || ""}
          </button>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting for review. Upload some videos.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((p) => (
            <div key={p.id} className="relative">
              <label className="absolute top-2 right-2 z-10 bg-background border border-border w-6 h-6 flex items-center justify-center cursor-pointer">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-foreground" />
              </label>
              <PostCard
                post={p}
                action={
                  <button onClick={() => genFor(p)} disabled={busy === p.id} className="w-full text-[11px] font-mono py-1.5 border border-border hover:bg-muted disabled:opacity-40">
                    {busy === p.id ? "Generating…" : p.caption_tiktok ? "Regenerate caption" : "Generate caption"}
                  </button>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
