// Kling video generation server functions
import { createServerFn } from "@tanstack/react-start";
import { SignJWT } from "jose";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KLING_BASE = "https://api-singapore.klingai.com";

async function klingToken() {
  const ak = process.env.KLING_ACCESS_KEY?.trim().replace(/^["']|["']$/g, "");
  const sk = process.env.KLING_SECRET_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!ak || !sk) throw new Error("KLING_ACCESS_KEY / KLING_SECRET_KEY not set");
  const now = Math.floor(Date.now() / 1000);
  // Kling requires these exact claims; iat is also expected by some validators.
  return await new SignJWT({ iss: ak, exp: now + 1800, nbf: now - 5 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .sign(new TextEncoder().encode(sk));
}

// Verifies Kling AK/SK by making a minimal authenticated request and reporting the raw result.
export const testKlingAuth = createServerFn({ method: "POST" }).handler(async () => {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  if (!ak || !sk) {
    return { ok: false, status: 0, code: null, message: "KLING_ACCESS_KEY or KLING_SECRET_KEY is not set",
      akPreview: null, akLength: 0, skLength: 0 };
  }
  const akPreview = `${ak.slice(0, 4)}…${ak.slice(-4)} (len ${ak.length})`;
  try {
    const token = await klingToken();
    // Hit a lightweight endpoint: list image2video tasks (auth-only, no body required)
    const res = await fetch(`${KLING_BASE}/v1/videos/image2video?pageNum=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep as text */ }
    const j = body as { code?: number; message?: string };
    const ok = res.ok && j.code === 0;
    return {
      ok, status: res.status, code: j.code ?? null,
      message: ok ? "Auth OK — Kling accepted the JWT" : (j.message ?? text.slice(0, 300)),
      akPreview, akLength: ak.length, skLength: sk.length,
    };
  } catch (e) {
    return { ok: false, status: 0, code: null,
      message: e instanceof Error ? e.message : String(e),
      akPreview, akLength: ak.length, skLength: sk.length };
  }
});

function publicUrl(bucket: string, path: string) {
  return supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Kick off generation: creates a draft post in 'generating' state with kling_task_id
export const startKlingGeneration = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: string; vibeId?: string; prompt?: string; duration?: 5 | 10 }) => d)
  .handler(async ({ data }) => {
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products").select("*").eq("id", data.productId).single();
    if (pErr || !product) throw new Error("Product not found");

    let vibe: { id: string; name: string; prompt_style: string } | null = null;
    if (data.vibeId) {
      const { data: v } = await supabaseAdmin.from("vibes").select("id,name,prompt_style").eq("id", data.vibeId).single();
      vibe = v;
    } else {
      const { data: vs } = await supabaseAdmin.from("vibes").select("id,name,prompt_style");
      if (vs?.length) vibe = vs[Math.floor(Math.random() * vs.length)];
    }

    const prompt = data.prompt?.trim() ||
      `${vibe?.prompt_style ?? "cinematic product showcase"}, smooth camera motion, professional lighting, high quality`;
    const imgUrl = publicUrl("product-images", product.image_path);
    const token = await klingToken();

    const res = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: "kling-v1",
        image: imgUrl,
        prompt,
        duration: String(data.duration ?? 5),
        aspect_ratio: "9:16",
        cfg_scale: 0.5,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(`Kling: ${JSON.stringify(j)}`);
    const taskId = j.data?.task_id as string;

    const { data: post, error: insErr } = await supabaseAdmin.from("posts").insert({
      vibe_id: vibe?.id ?? null,
      vibe_name: vibe?.name ?? null,
      video_path: "",
      status: "draft",
      generation_status: "generating",
      kling_task_id: taskId,
      generation_prompt: prompt,
      source_image_path: product.image_path,
    }).select().single();
    if (insErr) throw insErr;

    await supabaseAdmin.from("products").update({ videos_generated: product.videos_generated + 1 }).eq("id", product.id);
    return { postId: post.id, taskId };
  });

// Poll a job; if completed, downloads the video into the videos bucket and finalizes the post.
export const pollKlingPost = createServerFn({ method: "POST" })
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data }) => {
    const { data: post } = await supabaseAdmin.from("posts").select("*").eq("id", data.postId).single();
    if (!post?.kling_task_id) throw new Error("No task id");
    if (post.generation_status === "ready") return { status: "ready", videoPath: post.video_path };

    const token = await klingToken();
    const res = await fetch(`${KLING_BASE}/v1/videos/image2video/${post.kling_task_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(`Kling poll: ${JSON.stringify(j)}`);
    const status = j.data?.task_status as string;

    if (status === "succeed") {
      const videoUrl = j.data?.task_result?.videos?.[0]?.url as string;
      if (!videoUrl) throw new Error("No video url in result");
      const dl = await fetch(videoUrl);
      if (!dl.ok) throw new Error(`download ${dl.status}`);
      const buf = new Uint8Array(await dl.arrayBuffer());
      const path = `kling/${post.id}.mp4`;
      const up = await supabaseAdmin.storage.from("videos").upload(path, buf, { contentType: "video/mp4", upsert: true });
      if (up.error) throw up.error;
      await supabaseAdmin.from("posts").update({
        video_path: path, generation_status: "ready",
      }).eq("id", post.id);
      return { status: "ready", videoPath: path };
    }
    if (status === "failed") {
      const msg = j.data?.task_status_msg ?? "failed";
      await supabaseAdmin.from("posts").update({ generation_status: "failed", error: msg }).eq("id", post.id);
      return { status: "failed", error: msg };
    }
    return { status }; // submitted | processing
  });
