// content-pipeline.functions.ts
// Black Fish Corp — SMM Machine
// ZIP → Random Image → Random Prompt → Kling → Caption → Post
// Wired into TanStack Start server functions

import { createServerFn } from "@tanstack/react-start";
import { SignJWT } from "jose";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KLING_BASE = "https://api-singapore.klingai.com";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";

// ── Kling JWT auth (same pattern as kling.functions.ts) ──────────────────────
async function klingToken() {
  const ak = process.env.KLING_ACCESS_KEY?.trim().replace(/^[\"']|[\"']$/g, "");
  const sk = process.env.KLING_SECRET_KEY?.trim().replace(/^[\"']|[\"']$/g, "");
  if (!ak || !sk) throw new Error("KLING_ACCESS_KEY / KLING_SECRET_KEY not set");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ iss: ak, exp: now + 1800, nbf: now - 5 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .sign(new TextEncoder().encode(sk));
}

// ── Claude caption generator ─────────────────────────────────────────────────
async function generateCaption(
  imageBase64: string,
  hashtags: string
): Promise<string> {
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
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Write a short, high-impact TikTok marketing caption for this image. 
Bold, engaging, under 150 characters. 
End with: ${hashtags}
Return ONLY the caption.`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.content?.[0]?.text ?? "").trim();
}

// ── List prompt templates stored in Supabase ─────────────────────────────────
export const listPipelinePrompts = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("saved_prompts")
      .select("*")
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
);

// ── Run pipeline: pick random product image → caption → Kling video ──────────
export const runContentPipeline = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      promptOverride?: string;
      hashtags?: string;
      vibeId?: string;
      duration?: 5 | 10;
      skipKling?: boolean;
    }) => d
  )
  .handler(async ({ data }) => {
    const hashtags = data.hashtags ?? "#BlackFish #BlackFishCorp";
    const duration = data.duration ?? 5;
    const skipKling = data.skipKling ?? false;

    // ── Step 1: Pick a random product image from Supabase ──
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, image_path, name");
    if (pErr || !products?.length) throw new Error("No products found. Upload images first.");

    const product = products[Math.floor(Math.random() * products.length)];
    const imageUrl = supabaseAdmin.storage
      .from("product-images")
      .getPublicUrl(product.image_path).data.publicUrl;

    // ── Step 2: Pick random prompt ──
    let prompt = data.promptOverride?.trim();
    if (!prompt) {
      const { data: prompts } = await supabaseAdmin
        .from("saved_prompts")
        .select("id, prompt");
      if (prompts?.length) {
        const picked = prompts[Math.floor(Math.random() * prompts.length)];
        prompt = picked.prompt;
        // Increment use_count
        const { data: row } = await supabaseAdmin
          .from("saved_prompts").select("use_count").eq("id", picked.id).single();
        await supabaseAdmin
          .from("saved_prompts")
          .update({
            use_count: (row?.use_count ?? 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", picked.id);
      } else {
        prompt =
          "Animate this picture with smooth cinematic motion. Add the brand watermark logo at the end of the video.";
      }
    }

    // ── Step 3: Generate Claude caption ──
    let caption = "";
    try {
      // Fetch image and convert to base64 for Claude
      const imgRes = await fetch(imageUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const imgB64 = Buffer.from(imgBuf).toString("base64");
      caption = await generateCaption(imgB64, hashtags);
    } catch (e) {
      caption = `${hashtags}`;
      console.error("Caption generation failed:", e);
    }

    // ── Step 4: Send to Kling ──
    let klingTaskId: string | null = null;
    let klingError: string | null = null;

    if (!skipKling) {
      try {
        const token = await klingToken();
        const res = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_name: "kling-v1",
            image: imageUrl,
            prompt,
            duration: String(duration),
            aspect_ratio: "9:16",
            cfg_scale: 0.5,
          }),
        });
        const j = await res.json();
        if (!res.ok || j.code !== 0) {
          klingError = `Kling: ${JSON.stringify(j)}`;
        } else {
          klingTaskId = j.data?.task_id as string;
        }
      } catch (e) {
        klingError = e instanceof Error ? e.message : String(e);
      }
    }

    // ── Step 5: Create draft post in Supabase ──
    const { data: post, error: insErr } = await supabaseAdmin
      .from("posts")
      .insert({
        vibe_id: data.vibeId ?? null,
        video_path: "",
        status: "draft",
        generation_status: klingTaskId ? "generating" : klingError ? "failed" : "skipped",
        kling_task_id: klingTaskId,
        generation_prompt: prompt,
        source_image_path: product.image_path,
        caption_tiktok: caption,
        caption_instagram: caption,
        error: klingError,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return {
      postId: post.id,
      imageUsed: product.name ?? product.image_path,
      promptUsed: prompt,
      caption,
      klingTaskId,
      klingError,
      status: post.generation_status,
    };
  });

// ── Batch pipeline: run N times ───────────────────────────────────────────────
export const runBatchPipeline = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      count?: number;
      hashtags?: string;
      skipKling?: boolean;
    }) => d
  )
  .handler(async ({ data }) => {
    const count = Math.min(data.count ?? 3, 10); // cap at 10 per batch
    const results = [];

    for (let i = 0; i < count; i++) {
      try {
        // Re-use runContentPipeline logic inline to avoid nested server fn calls
        const hashtags = data.hashtags ?? "#BlackFish #BlackFishCorp";
        const skipKling = data.skipKling ?? false;

        const { data: products } = await supabaseAdmin
          .from("products")
          .select("id, image_path, name");

        if (!products?.length) {
          results.push({ index: i + 1, error: "No products found" });
          continue;
        }

        const product = products[Math.floor(Math.random() * products.length)];
        const imageUrl = supabaseAdmin.storage
          .from("product-images")
          .getPublicUrl(product.image_path).data.publicUrl;

        const { data: prompts } = await supabaseAdmin
          .from("saved_prompts")
          .select("prompt");
        const prompt =
          prompts?.length
            ? prompts[Math.floor(Math.random() * prompts.length)].prompt
            : "Animate this picture with smooth cinematic motion.";

        let caption = hashtags;
        try {
          const imgRes = await fetch(imageUrl);
          const imgBuf = await imgRes.arrayBuffer();
          const imgB64 = Buffer.from(imgBuf).toString("base64");
          caption = await generateCaption(imgB64, hashtags);
        } catch { /* caption fallback */ }

        let klingTaskId: string | null = null;
        let klingError: string | null = null;

        if (!skipKling) {
          try {
            const token = await klingToken();
            const res = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model_name: "kling-v1",
                image: imageUrl,
                prompt,
                duration: "5",
                aspect_ratio: "9:16",
                cfg_scale: 0.5,
              }),
            });
            const j = await res.json();
            if (!res.ok || j.code !== 0) klingError = JSON.stringify(j);
            else klingTaskId = j.data?.task_id as string;
          } catch (e) {
            klingError = e instanceof Error ? e.message : String(e);
          }
        }

        const { data: post } = await supabaseAdmin
          .from("posts")
          .insert({
            video_path: "",
            status: "draft",
            generation_status: klingTaskId ? "generating" : "failed",
            kling_task_id: klingTaskId,
            generation_prompt: prompt,
            source_image_path: product.image_path,
            caption_tiktok: caption,
            caption_instagram: caption,
            error: klingError,
          })
          .select()
          .single();

        results.push({
          index: i + 1,
          postId: post?.id,
          image: product.name ?? product.image_path,
          prompt,
          caption,
          klingTaskId,
          klingError,
        });
      } catch (e) {
        results.push({
          index: i + 1,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return { requested: count, completed: results.length, results };
  });
