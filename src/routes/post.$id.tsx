import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post, Vibe, fmtDate, videoUrl, STATUS_LABEL } from "@/lib/socio-shared";
import { postNow, generateCaptions } from "@/lib/socio.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/post/$id")({ component: PostDetail });

function PostDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const postNowFn = useServerFn(postNow);
  const genFn = useServerFn(generateCaptions);
  const [tt, setTt] = useState("");
  const [ig, setIg] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram"]);
  const [vibeId, setVibeId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: post } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Post;
    },
  });
  const { data: vibes = [] } = useQuery({
    queryKey: ["vibes"],
    queryFn: async () => (await supabase.from("vibes").select("*")).data as Vibe[],
  });

  useEffect(() => {
    if (!post) return;
    setTt(post.caption_tiktok ?? "");
    setIg(post.caption_instagram ?? "");
    setPlatforms(post.platforms);
    setVibeId(post.vibe_id ?? "");
    setScheduledFor(post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : "");
  }, [post?.id]);

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function save(extra: Partial<Post> = {}) {
    const vibe = vibes.find((v) => v.id === vibeId);
    const { error } = await supabase.from("posts").update({
      caption_tiktok: tt, caption_instagram: ig, platforms,
      vibe_id: vibeId || null, vibe_name: vibe?.name ?? null,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      ...extra,
    }).eq("id", id);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["posts"] });
    qc.invalidateQueries({ queryKey: ["post", id] });
  }

  async function handleSchedule() {
    if (!scheduledFor) return toast.error("Pick a date/time first");
    setBusy(true);
    try {
      await save({ status: "scheduled" });
      toast.success("Scheduled");
      navigate({ to: "/scheduled" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handlePostNow() {
    setBusy(true);
    try {
      await save();
      const r = await postNowFn({ data: { postId: id } });
      if (r.ok) { toast.success("Posted!"); navigate({ to: "/posted" }); }
      else toast.error(r.error || "Failed");
      qc.invalidateQueries({ queryKey: ["posts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function regenerate() {
    const vibe = vibes.find((v) => v.id === vibeId) ?? vibes[0];
    if (!vibe) return;
    setBusy(true);
    try {
      const brief = localStorage.getItem("socio-brief") ?? "";
      const r = await genFn({ data: { vibe: { name: vibe.name, prompt_style: vibe.prompt_style, caption_tone: vibe.caption_tone }, brief } });
      setTt(r.tiktok); setIg(r.instagram);
      toast.success("Captions generated");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function del() {
    if (!post || !confirm("Delete this post?")) return;
    await supabase.storage.from("videos").remove([post.video_path]);
    await supabase.from("posts").delete().eq("id", id);
    toast.success("Deleted");
    navigate({ to: "/" });
  }

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-6">
      <div className="space-y-3">
        <div className="aspect-[9/16] bg-muted overflow-hidden border border-border">
          <video src={videoUrl(post.video_path)} controls playsInline className="w-full h-full object-cover" />
        </div>
        <div className="border border-border p-3 text-xs space-y-1 font-mono">
          <p className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{STATUS_LABEL[post.status]}</span></p>
          <p className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{fmtDate(post.created_at)}</span></p>
          <p className="flex justify-between"><span className="text-muted-foreground">Scheduled</span><span>{fmtDate(post.scheduled_for)}</span></p>
          <p className="flex justify-between"><span className="text-muted-foreground">Posted</span><span>{fmtDate(post.posted_at)}</span></p>
        </div>
        {post.error && <div className="border border-destructive p-3 text-xs text-destructive">{post.error}</div>}
        <button onClick={del} className="w-full text-xs font-mono py-2 border border-border hover:bg-destructive hover:text-destructive-foreground">Delete</button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground">Vibe</label>
          <select value={vibeId} onChange={(e) => setVibeId(e.target.value)} className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm">
            {vibes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-4">
          {(["tiktok", "instagram"] as const).map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm font-mono">
              <input type="checkbox" checked={platforms.includes(p)} onChange={(e) => setPlatforms((arr) => e.target.checked ? [...arr, p] : arr.filter((x) => x !== p))} className="accent-foreground" />
              {p}
            </label>
          ))}
          <button onClick={regenerate} disabled={busy} className="ml-auto px-3 py-1.5 border border-border text-xs font-mono">{busy ? "…" : "Regenerate captions"}</button>
        </div>

        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground">TikTok caption</label>
          <textarea value={tt} onChange={(e) => setTt(e.target.value)} rows={4} className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono" />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{tt.length} chars</p>
        </div>

        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground">Instagram caption</label>
          <textarea value={ig} onChange={(e) => setIg(e.target.value)} rows={6} className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono" />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{ig.length} chars</p>
        </div>

        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground">Scheduled time (UTC)</label>
          <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono" />
        </div>

        <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
          <button onClick={() => save().then(() => toast.success("Saved"))} disabled={busy} className="px-4 py-2 border border-border text-sm font-mono">Save draft</button>
          <button onClick={handleSchedule} disabled={busy} className="px-4 py-2 border border-foreground text-sm font-mono">Schedule</button>
          <button onClick={handlePostNow} disabled={busy} className="px-4 py-2 bg-foreground text-background text-sm font-mono">Post now</button>
        </div>
      </div>
    </div>
  );
}
