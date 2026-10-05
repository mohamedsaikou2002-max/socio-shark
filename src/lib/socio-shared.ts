// Shared helpers

export type PostStatus = "draft" | "scheduled" | "posting" | "posted" | "failed";

export interface Post {
  id: string;
  created_at: string;
  vibe_id: string | null;
  vibe_name: string | null;
  video_path: string;
  caption_tiktok: string | null;
  caption_instagram: string | null;
  status: PostStatus;
  scheduled_for: string | null;
  posted_at: string | null;
  tiktok_post_id: string | null;
  ig_post_id: string | null;
  platforms: string[];
  error: string | null;
  notes: string | null;
  source_image_path: string | null;
}

export function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  posting: "Posting…",
  posted: "Posted",
  failed: "Failed",
};
