// Kling video generation server functions
// Auth, submission and polling live in providers/kling.ts so this flow and the
// batch pipeline (content-pipeline.functions.ts) share one implementation.
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { submitImage2Video, fetchImage2VideoTask } from "@/lib/providers/kling";

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

    const { taskId } = await submitImage2Video({
      imageUrl: imgUrl,
      prompt,
      duration: data.duration ?? 5,
    });

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

    const task = await fetchImage2VideoTask(post.kling_task_id);

    if (task.status === "succeed") {
      if (!task.videoUrl) throw new Error("No video url in result");
      const dl = await fetch(task.videoUrl);
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
    if (task.status === "failed") {
      const msg = task.message ?? "failed";
      await supabaseAdmin.from("posts").update({ generation_status: "failed", error: msg }).eq("id", post.id);
      return { status: "failed", error: msg };
    }
    return { status: task.status }; // submitted | processing
  });
