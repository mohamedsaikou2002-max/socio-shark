// Server functions for Socio-Shark
// Caption generation via Lovable AI, posting to TikTok and Instagram.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";

interface Vibe {
  name: string;
  prompt_style: string;
  caption_tone: string;
}

async function llm(prompt: string, max = 350): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: max,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.content?.[0]?.text ?? "").trim();
}

function captionPrompt(vibe: Vibe, brief: string, platform: "tiktok" | "instagram") {
  const limit = platform === "instagram" ? 2200 : 150;
  return `Write a ${platform} caption for a marketing video.

PRODUCT BRIEF:
${brief.trim() || "(no brief provided — write a generic punchy caption)"}

VIBE: ${vibe.name} — ${vibe.caption_tone}

Rules:
- Hook in the first line
- 3–5 relevant hashtags at the end
- ${platform === "tiktok" ? "punchy, short sentences, no emoji at start" : "slightly longer, mild storytelling"}
- Stay under ${limit} characters
- Sound human, not AI marketing copy

Return ONLY the caption.`;
}

export const generateCaptions = createServerFn({ method: "POST" })
  .inputValidator((d: { vibe: Vibe; brief: string }) => d)
  .handler(async ({ data }) => ({
    tiktok: await llm(captionPrompt(data.vibe, data.brief, "tiktok"), 250),
    instagram: await llm(captionPrompt(data.vibe, data.brief, "instagram"), 600),
  }));

// ── Posting ────────────────────────────────────────────────────────────────

async function postToInstagram(videoUrl: string, caption: string) {
  const token = process.env.META_ACCESS_TOKEN;
  const igId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!token || !igId) throw new Error("Instagram tokens missing");
  const create = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, access_token: token }),
  });
  const created = await create.json();
  if (!create.ok) throw new Error(`IG create: ${JSON.stringify(created)}`);
  // wait for processing
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(`https://graph.facebook.com/v21.0/${created.id}?fields=status_code&access_token=${token}`);
    const sj = await s.json();
    if (sj.status_code === "FINISHED") break;
    if (sj.status_code === "ERROR") throw new Error(`IG processing error`);
  }
  const pub = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: created.id, access_token: token }),
  });
  const pubJson = await pub.json();
  if (!pub.ok) throw new Error(`IG publish: ${JSON.stringify(pubJson)}`);
  return pubJson.id as string;
}

async function postToTikTok(videoUrl: string, caption: string) {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) throw new Error("TikTok token missing");
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: { title: caption.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE" },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }),
  });
  const j = await res.json();
  if (!res.ok || j.error?.code !== "ok") throw new Error(`TikTok: ${JSON.stringify(j)}`);
  return j.data?.publish_id as string;
}

async function publicVideoUrl(path: string) {
  const { data } = supabaseAdmin.storage.from("videos").getPublicUrl(path);
  return data.publicUrl;
}

export const postNow = createServerFn({ method: "POST" })
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data }) => {
    const { data: post, error } = await supabaseAdmin
      .from("posts").select("*").eq("id", data.postId).single();
    if (error || !post) throw new Error("Post not found");
    const url = await publicVideoUrl(post.video_path);
    const platforms = post.platforms as string[];
    const result: { tiktok?: string; ig?: string; error?: string } = {};
    try {
      if (platforms.includes("tiktok") && post.caption_tiktok) {
        result.tiktok = await postToTikTok(url, post.caption_tiktok);
      }
      if (platforms.includes("instagram") && post.caption_instagram) {
        result.ig = await postToInstagram(url, post.caption_instagram);
      }
      await supabaseAdmin.from("posts").update({
        status: "posted",
        posted_at: new Date().toISOString(),
        tiktok_post_id: result.tiktok ?? null,
        ig_post_id: result.ig ?? null,
        error: null,
      }).eq("id", post.id);
      return { ok: true, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("posts").update({ status: "failed", error: msg }).eq("id", post.id);
      return { ok: false, error: msg };
    }
  });

// Auto-schedule: pick the next free schedule slot for each draft
export const autoSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: { postIds: string[] }) => d)
  .handler(async ({ data }) => {
    const { data: slots } = await supabaseAdmin.from("schedule_slots")
      .select("*").eq("enabled", true).order("hour").order("minute");
    if (!slots?.length) throw new Error("No schedule slots configured");
    const { data: taken } = await supabaseAdmin.from("posts")
      .select("scheduled_for").in("status", ["scheduled", "posted"])
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
    for (const id of data.postIds) {
      const at = nextSlotAfter(cursor);
      cursor = at;
      await supabaseAdmin.from("posts").update({
        status: "scheduled", scheduled_for: at.toISOString(),
      }).eq("id", id);
      results.push({ id, at: at.toISOString() });
    }
    return { scheduled: results };
  });
