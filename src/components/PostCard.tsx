import { Post, STATUS_LABEL, fmtDate } from "@/lib/socio-shared";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";
import { Link } from "@tanstack/react-router";

export function PostCard({ post, action }: { post: Post; action?: React.ReactNode }) {
  const videoSrc = useSignedStorageUrl("videos", post.video_path || null);
  const imageSrc = useSignedStorageUrl("product-images", post.source_image_path);
  return (
    <div className="border border-border bg-card group">
      <Link to="/post/$id" params={{ id: post.id }} className="block">
        <div className="aspect-[9/16] bg-muted overflow-hidden relative">
          {post.video_path ? (
            <video src={videoSrc ?? undefined} muted playsInline className="w-full h-full object-cover" />
          ) : post.source_image_path ? (
            <img src={imageSrc ?? undefined} alt="" className="w-full h-full object-cover opacity-60" />
          ) : (
            <div className="w-full h-full" />
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-foreground text-background text-[10px] font-mono uppercase tracking-wider">
            {STATUS_LABEL[post.status]}
          </div>
        </div>
      </Link>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase">
          <span>{post.video_path ? "Video" : "Media"}</span>
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
