// Server functions for manually reviewed and scheduled content publishing.
// Provider credentials live in src/lib/providers/* and the protected secrets store.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { postReels } from "@/lib/providers/meta";
import { getTikTokPublishStatus, postVideo } from "@/lib/providers/tiktok";
import { requireSupabaseAuth, requireSupabaseAuthOrCron } from "@/integrations/supabase/auth-middleware";

// ── Posting ────────────────────────────────────────────────────────────────
// Instagram (Meta Graph) and TikTok implementations live in their provider
// modules — see providers/meta.ts and providers/tiktok.ts.

async function publicVideoUrl(path: string) {
  const { data, error } = await supabaseAdmin.storage.from("videos").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export const postNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuthOrCron])
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data, context }) => {
    let postQuery = supabaseAdmin.from("posts").select("*").eq("id", data.postId);
    if (context.userId !== "cron") postQuery = postQuery.eq("owner_user_id", context.userId);
    const { data: initialPost, error } = await postQuery.single();
    if (error || !initialPost) throw new Error("Post not found");
    const ownerUserId = initialPost.owner_user_id;
    if (!ownerUserId) throw new Error("Post is not assigned to a client account");
    if (!["draft", "scheduled"].includes(initialPost.status)) {
      throw new Error(`Post cannot be published from status '${initialPost.status}'`);
    }
    const url = await publicVideoUrl(initialPost.video_path);
    const platforms = initialPost.platforms as string[];
    if (!initialPost.video_path) throw new Error("Upload a video before publishing this post");
    if (!platforms.some((platform) => platform === "tiktok" || platform === "instagram")) {
      throw new Error("Select TikTok or Instagram before publishing this post");
    }
    if (platforms.includes("tiktok") && !initialPost.caption_tiktok?.trim()) {
      throw new Error("TikTok caption is required before publishing");
    }
    if (platforms.includes("instagram") && !initialPost.caption_instagram?.trim()) {
      throw new Error("Instagram caption is required before publishing");
    }
    let claimQuery = supabaseAdmin.from("posts").update({ status: "posting", error: null })
      .eq("id", data.postId).in("status", ["draft", "scheduled"]);
    if (context.userId !== "cron") claimQuery = claimQuery.eq("owner_user_id", context.userId);
    const { data: claimed, error: claimError } = await claimQuery.select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) throw new Error("Post is already being published or is no longer available");

    const post = initialPost;
    const result: { tiktok?: string; ig?: string; error?: string } = {};
    try {
      if (platforms.includes("tiktok") && post.caption_tiktok) {
        result.tiktok = await postVideo(url, post.caption_tiktok);
      }
      if (platforms.includes("instagram") && post.caption_instagram) {
        result.ig = await postReels(url, post.caption_instagram);
      }
      const isTikTokPending = Boolean(result.tiktok);
      const { error: updateError } = await supabaseAdmin.from("posts").update({
        status: isTikTokPending ? "posting" : "posted",
        posted_at: isTikTokPending ? null : new Date().toISOString(),
        tiktok_post_id: result.tiktok ?? null,
        ig_post_id: result.ig ?? null,
        error: null,
      }).eq("id", post.id).eq("owner_user_id", ownerUserId);
      if (updateError) throw updateError;
      return { ok: true, pending: isTikTokPending, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("posts").update({
        status: "failed",
        tiktok_post_id: result.tiktok ?? null,
        ig_post_id: result.ig ?? null,
        error: msg,
      }).eq("id", post.id).eq("owner_user_id", ownerUserId);
      return { ok: false, error: msg, ...result };
    }
  });

// Auto-schedule: pick the next free schedule slot for each draft
export const autoSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    const postIds = [...new Set(data.postIds)];
    if (!postIds.length || postIds.length > 100) {
      throw new Error("Choose between 1 and 100 draft posts to schedule");
    }
    const { data: slots } = await supabaseAdmin.from("schedule_slots")
      .select("*").eq("owner_user_id", context.userId).eq("enabled", true).order("hour").order("minute");
    if (!slots?.length) throw new Error("No schedule slots configured");
    const { data: taken } = await supabaseAdmin.from("posts")
      .select("scheduled_for").in("status", ["scheduled", "posted", "posting"])
      .eq("owner_user_id", context.userId)
      .gte("scheduled_for", new Date().toISOString());
    const takenSet = new Set((taken ?? []).map((t) => t.scheduled_for));

    const now = new Date();
    function nextSlotAfter(after: Date): Date {
      for (let day = 0; day < 60; day++) {
        for (const s of slots!) {
          const dt = new Date(after);
          dt.setUTCDate(dt.getUTCDate() + day);
          dt.setUTCHours(s.hour, s.minute, 0, 0);
          if (dt > after && !takenSet.has(dt.toISOString())) {
            takenSet.add(dt.toISOString());
            return dt;
          }
        }
      }
      throw new Error("No free slot found");
    }

    let cursor = now;
    const results: { id: string; at: string }[] = [];
    for (const id of postIds) {
      const at = nextSlotAfter(cursor);
      cursor = at;
      const { data: updated, error: updateError } = await supabaseAdmin.from("posts").update({
        status: "scheduled", scheduled_for: at.toISOString(),
      }).eq("id", id).eq("owner_user_id", context.userId).eq("status", "draft").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error(`Post ${id} is missing or is no longer a draft`);
      results.push({ id, at: at.toISOString() });
    }
    return { scheduled: results };
  });
