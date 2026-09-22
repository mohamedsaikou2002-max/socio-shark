// providers/kling.ts — Kling video provider.
//
// The ONLY place that knows how Kling authentication and task calls work.
// Both the single-post flow (kling.functions.ts) and the batch/auto pipeline
// (content-pipeline.functions.ts) call into here, so the two code paths can
// never drift apart again. Secrets come from getSecret() (env → DB), never
// from a raw process.env read.
import { SignJWT } from "jose";
import { requireSecret } from "@/lib/secrets.core";
import type { ProviderTestResult } from "@/lib/providers/registry";

export const KLING_BASE = "https://api-singapore.klingai.com";

/** Build the short-lived JWT Kling expects (AK as issuer, SK as HMAC secret). */
export async function klingToken(): Promise<string> {
  const ak = await requireSecret("KLING_ACCESS_KEY");
  const sk = await requireSecret("KLING_SECRET_KEY");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ iss: ak, exp: now + 1800, nbf: now - 5 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .sign(new TextEncoder().encode(sk));
}

/** Kick off an image → video job. Throws with Kling's raw response on failure. */
export async function submitImage2Video(opts: {
  imageUrl: string;
  prompt: string;
  duration?: 5 | 10;
}): Promise<{ taskId: string }> {
  const token = await klingToken();
  const res = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_name: "kling-v1",
      image: opts.imageUrl,
      prompt: opts.prompt,
      duration: String(opts.duration ?? 5),
      aspect_ratio: "9:16",
      cfg_scale: 0.5,
    }),
  });
  const j = await res.json();
  if (!res.ok || j.code !== 0) throw new Error(`Kling: ${JSON.stringify(j)}`);
  return { taskId: j.data?.task_id as string };
}

/** Poll a job. Returns status plus the video url / failure message when known. */
export async function fetchImage2VideoTask(taskId: string): Promise<{
  status: string;
  videoUrl?: string;
  message?: string;
}> {
  const token = await klingToken();
  const res = await fetch(`${KLING_BASE}/v1/videos/image2video/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await res.json();
  if (!res.ok || j.code !== 0) throw new Error(`Kling poll: ${JSON.stringify(j)}`);
  return {
    status: j.data?.task_status as string,
    videoUrl: j.data?.task_result?.videos?.[0]?.url as string | undefined,
    message: j.data?.task_status_msg as string | undefined,
  };
}

/** testAuth() — minimal authenticated request, reports Kling's raw answer. */
export async function testKlingAuth(): Promise<ProviderTestResult> {
  const providerId = "kling";
  let ak: string;
  let sk: string;
  try {
    ak = await requireSecret("KLING_ACCESS_KEY");
    sk = await requireSecret("KLING_SECRET_KEY");
  } catch (e) {
    return { providerId, ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
  const detail = `AK ${ak.slice(0, 4)}…${ak.slice(-4)} (len ${ak.length}) · SK length ${sk.length}`;
  try {
    const token = await klingToken();
    // Lightweight auth-only endpoint: list image2video tasks
    const res = await fetch(`${KLING_BASE}/v1/videos/image2video?pageNum=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    const j = body as { code?: number; message?: string };
    const ok = res.ok && j.code === 0;
    return {
      providerId,
      ok,
      status: res.status,
      message: ok ? "Auth OK — Kling accepted the JWT" : (j.message ?? text.slice(0, 300)),
      detail,
    };
  } catch (e) {
    return {
      providerId,
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : String(e),
      detail,
    };
  }
}
