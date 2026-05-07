import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/socio-shared";
import { PostCard } from "@/components/PostCard";
import { SharkLogo } from "@/components/SharkLogo";

export const Route = createFileRoute("/")({ component: Library });

function Library() {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const counts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <section className="border border-border p-6 md:p-10 shark-grid-bg">
        <div className="flex items-start gap-4">
          <SharkLogo className="w-12 h-12 text-foreground shrink-0" />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Autonomous social ops.</h1>
            <p className="mt-2 text-muted-foreground max-w-xl text-sm">
              Drop your videos in. Socio-Shark writes the captions, queues the posts, and ships them
              to TikTok and Instagram on schedule — while you sleep.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/upload" className="px-4 py-2 bg-foreground text-background text-sm font-mono">+ Upload videos</Link>
              <Link to="/queue" className="px-4 py-2 border border-border text-sm font-mono hover:bg-muted">Review queue</Link>
              <Link to="/settings" className="px-4 py-2 border border-border text-sm font-mono hover:bg-muted">Settings</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Draft", counts.draft || 0],
          ["Scheduled", counts.scheduled || 0],
          ["Posting", counts.posting || 0],
          ["Posted", counts.posted || 0],
          ["Failed", counts.failed || 0],
        ].map(([k, v]) => (
          <div key={k} className="border border-border p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="text-2xl font-bold mt-1">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">Library</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">No videos yet.</p>
            <Link to="/upload" className="mt-3 inline-block px-4 py-2 bg-foreground text-background text-sm font-mono">Upload your first batch</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
