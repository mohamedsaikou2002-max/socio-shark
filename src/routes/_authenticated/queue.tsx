import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/socio-shared";
import { PostCard } from "@/components/PostCard";
import { autoSchedule } from "@/lib/socio.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/queue")({ component: QueuePage });

function QueuePage() {
  const queryClient = useQueryClient();
  const scheduleFn = useServerFn(autoSchedule);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scheduling, setScheduling] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", "draft"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("status", "draft").order("created_at");
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function scheduleSelected() {
    if (!selected.size) return toast.error("Select at least one item");
    setScheduling(true);
    try {
      const result = await scheduleFn({ data: { postIds: Array.from(selected) } });
      toast.success(`Scheduled ${result.scheduled.length} item${result.scheduled.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule selected content");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-muted-foreground">Your content</p>
          <h1 className="mt-1 text-2xl font-bold">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select uploaded videos to schedule. Open an item to edit its captions, platforms, and date.</p>
        </div>
        {posts.length > 0 && <div className="flex gap-2">
          <button onClick={() => setSelected(selected.size === posts.length ? new Set() : new Set(posts.map((post) => post.id)))} className="border border-border px-3 py-2 text-sm font-mono">
            {selected.size === posts.length ? "Clear selection" : "Select all"}
          </button>
          <button onClick={() => void scheduleSelected()} disabled={!selected.size || scheduling} className="bg-foreground px-3 py-2 text-sm font-mono text-background disabled:opacity-40">
            {scheduling ? "Scheduling…" : `Schedule ${selected.size || "selected"}`}
          </button>
        </div>}
      </header>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading queue…</p> : posts.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Nothing waiting in your queue.</p>
          <Link to="/upload" className="mt-3 inline-block bg-foreground px-4 py-2 text-sm font-mono text-background">Upload videos</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {posts.map((post) => <div key={post.id} className="relative">
            <label className="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center border border-border bg-background" aria-label={`Select ${post.id}`}>
              <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggle(post.id)} className="accent-foreground" />
            </label>
            <PostCard post={post} />
          </div>)}
        </div>
      )}
    </div>
  );
}
