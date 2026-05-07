import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Post } from "@/lib/socio-shared";
import { PostCard } from "@/components/PostCard";

export const Route = createFileRoute("/posted")({ component: Posted });

function Posted() {
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", "posted"],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").in("status", ["posted", "failed"]).order("posted_at", { ascending: false });
      return (data ?? []) as Post[];
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Posted</h1>
        <p className="text-sm text-muted-foreground mt-1">Live posts and any failures.</p>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing posted yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
