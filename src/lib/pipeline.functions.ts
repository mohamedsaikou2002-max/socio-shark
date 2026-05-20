// One-click content pipeline: random product + random saved prompt -> Kling generation
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { startKlingGeneration } from "./kling.functions";

interface RunResult {
  ok: boolean;
  postId?: string;
  taskId?: string;
  productId?: string;
  productName?: string | null;
  promptTitle?: string | null;
  promptText?: string;
  error?: string;
}

async function runOnce(): Promise<RunResult> {
  // Pick a random product (prefer lower videos_generated for spread)
  const { data: products, error: pErr } = await supabaseAdmin
    .from("products").select("id,name,videos_generated").order("videos_generated", { ascending: true }).limit(20);
  if (pErr) return { ok: false, error: pErr.message };
  if (!products?.length) return { ok: false, error: "No products uploaded" };
  const product = products[Math.floor(Math.random() * products.length)];

  // Pick a random saved prompt (optional — fall back to vibe default)
  const { data: prompts } = await supabaseAdmin.from("saved_prompts").select("id,title,prompt,vibe_id,duration");
  let promptText: string | undefined;
  let promptTitle: string | null = null;
  let vibeId: string | undefined;
  let duration: 5 | 10 = 5;
  if (prompts?.length) {
    const sp = prompts[Math.floor(Math.random() * prompts.length)];
    promptText = sp.prompt;
    promptTitle = sp.title;
    vibeId = sp.vibe_id ?? undefined;
    duration = (sp.duration === 10 ? 10 : 5);
    await supabaseAdmin.from("saved_prompts").update({
      use_count: ((sp as { use_count?: number }).use_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    }).eq("id", sp.id);
  }

  try {
    const r = await startKlingGeneration({
      data: { productId: product.id, vibeId, prompt: promptText, duration },
    });
    return {
      ok: true, postId: r.postId, taskId: r.taskId,
      productId: product.id, productName: product.name,
      promptTitle, promptText,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e),
      productId: product.id, productName: product.name, promptTitle, promptText };
  }
}

export const runPipelineOnce = createServerFn({ method: "POST" }).handler(async () => runOnce());

export const runPipelineBatch = createServerFn({ method: "POST" })
  .inputValidator((d: { count: number }) => ({ count: Math.max(1, Math.min(10, Math.floor(d.count))) }))
  .handler(async ({ data }) => {
    const results: RunResult[] = [];
    for (let i = 0; i < data.count; i++) {
      results.push(await runOnce());
      // small delay so Kling doesn't choke
      await new Promise((r) => setTimeout(r, 500));
    }
    return { count: results.length, ok: results.filter(r => r.ok).length, results };
  });
