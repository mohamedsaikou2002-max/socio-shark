// providers/tiktok.ts — TikTok Content Posting API.
import { requireSecret } from "@/lib/secrets.core";
import type { ProviderTestResult } from "@/lib/providers/registry";

const TIKTOK_BASE = "https://open.tiktokapis.com/v2";

export async function tiktokToken(): Promise<string> {
  return await requireSecret("TIKTOK_ACCESS_TOKEN");
}

/** Action: publish a video pulled from a URL; returns the publish id. */
export async function postVideo(videoUrl: string, caption: string): Promise<string> {
  const token = await tiktokToken();
  const res = await fetch(`${TIKTOK_BASE}/post/publish/video/init/`, {
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

/** testAuth() — call a lightweight endpoint with the token and report raw result. */
export async function testTikTokAuth(): Promise<ProviderTestResult> {
  const providerId = "tiktok";
  let token: string;
  try {
    token = await tiktokToken();
  } catch (e) {
    return { providerId, ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
  const detail = `token ${token.slice(0, 4)}…${token.slice(-4)} (len ${token.length})`;
  try {
    const res = await fetch(`${TIKTOK_BASE}/user/info/?fields=open_id,nickname`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let j: {
      error?: { code?: string; message?: string };
      data?: { user?: { nickname?: string } };
    };
    try {
      j = JSON.parse(text);
    } catch {
      j = {};
    }
    const ok = res.ok && (!j.error || j.error.code === "ok");
    return {
      providerId,
      ok,
      status: res.status,
      message: ok
        ? `Auth OK${j.data?.user?.nickname ? ` — @${j.data.user.nickname}` : ""}`
        : (j.error?.message ?? text.slice(0, 300)),
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
