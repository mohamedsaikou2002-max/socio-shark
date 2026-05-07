import { Post, STATUS_LABEL, fmtDate, videoUrl } from "@/lib/socio-shared";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

export function PostCard({ post, action }: { post: Post; action?: React.ReactNode }) {
  return (
    <div className="border border-border bg-card group">
      <Link to="/post/$id" params={{ id: post.id }} className="block">
        <div className="aspect-[9/16] bg-muted overflow-hidden relative">
          {post.video_path ? (
            <video src={videoUrl(post.video_path)} muted playsInline className="w-full h-full object-cover" />
          ) : post.source_image_path ? (
            <img src={`${videoUrl("").replace("/videos/", "/product-images/")}${post.source_image_path}`} alt="" className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full" />
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-foreground text-background text-[10px] font-mono uppercase tracking-wider">
            {post.generation_status === "generating" ? "Generating…" : post.generation_status === "failed" ? "Gen failed" : STATUS_LABEL[post.status]}
          </div>
        </div>
      </Link>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase">
          <span>{post.vibe_name ?? "—"}</span>
          <span>{post.platforms.join(" · ")}</span>
        </div>
        <p className="text-xs line-clamp-2 text-foreground/80">
          {post.caption_tiktok || post.caption_instagram || <span className="text-muted-foreground italic">no caption yet</span>}
        </p>
        {post.scheduled_for && (
          <p className="text-[10px] font-mono text-muted-foreground">→ {fmtDate(post.scheduled_for)}</p>
        )}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}
