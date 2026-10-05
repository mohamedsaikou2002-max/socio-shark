// providers/tiktok.ts — TikTok Content Posting API.
import { requireSecret } from "@/lib/secrets.core";
import type { ProviderTestResult } from "@/lib/providers/registry";

const TIKTOK_BASE = "https://open.tiktokapis.com/v2";

export async function tiktokToken(): Promise<string> {
  return await requireSecret("TIKTOK_ACCESS_TOKEN");
}

/** Action: upload a video from storage to TikTok; returns its asynchronous publish id. */
export async function postVideo(videoUrl: string, caption: string): Promise<string> {
  const token = await tiktokToken();
  if (caption.length > 2200) {
    throw new Error("TikTok caption exceeds the 2,200 character limit");
  }
  const creatorInfoRes = await fetch(`${TIKTOK_BASE}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const creatorInfo = await creatorInfoRes.json();
  if (!creatorInfoRes.ok || creatorInfo.error?.code !== "ok") {
    throw new Error(`TikTok creator authorization: ${JSON.stringify(creatorInfo)}`);
  }
  if (!creatorInfo.data?.privacy_level_options?.includes("PUBLIC_TO_EVERYONE")) {
    throw new Error("TikTok account does not allow public posts for this app");
  }
  const media = await fetch(videoUrl);
  if (!media.ok) throw new Error(`Video download failed: HTTP ${media.status}`);
  const contentType = media.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType && contentType !== "video/mp4") {
    throw new Error(`TikTok direct posting expects MP4 video, received ${contentType}`);
  }
  const bytes = new Uint8Array(await media.arrayBuffer());
  if (!bytes.byteLength) throw new Error("Video file is empty");

  // FILE_UPLOAD avoids TikTok's URL ownership verification requirement for
  // PULL_FROM_URL, which generally cannot be satisfied for Supabase URLs.
  // Files under 5 MB use one chunk. Otherwise TikTok accepts 5–64 MB chunks;
  // the last chunk absorbs any remainder (up to 128 MB).
  const size = bytes.byteLength;
  const chunkSize = size < 5 * 1024 * 1024 ? size : Math.min(size, 32 * 1024 * 1024);
  const totalChunks = Math.max(1, Math.floor(size / chunkSize));
  const res = await fetch(`${TIKTOK_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: { title: caption, privacy_level: "PUBLIC_TO_EVERYONE" },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: bytes.byteLength,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks,
      },
    }),
  });
  const j = await res.json();
  if (!res.ok || j.error?.code !== "ok" || !j.data?.publish_id || !j.data?.upload_url) {
    throw new Error(`TikTok: ${JSON.stringify(j)}`);
  }

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * chunkSize;
    const end = i === totalChunks - 1 ? size : offset + chunkSize;
    const chunk = bytes.subarray(offset, end);
    const upload = await fetch(j.data.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${bytes.byteLength}`,
      },
      body: chunk,
    });
    if (upload.status !== 201 && upload.status !== 206) {
      throw new Error(`TikTok video upload failed: HTTP ${upload.status} ${await upload.text()}`);
    }
  }
  return j.data.publish_id as string;
}

export async function getTikTokPublishStatus(publishId: string): Promise<{
  status: string;
  reason?: string;
}> {
  const token = await tiktokToken();
  const res = await fetch(`${TIKTOK_BASE}/post/publish/status/fetch/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const j = await res.json();
  if (!res.ok || j.error?.code !== "ok") {
    throw new Error(`TikTok status: ${JSON.stringify(j)}`);
  }
  return { status: j.data?.status ?? "UNKNOWN", reason: j.data?.fail_reason };
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
  const detail = `Access token present (length ${token.length})`;
  try {
    const res = await fetch(`${TIKTOK_BASE}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    const text = await res.text();
    let j: {
      error?: { code?: string; message?: string };
      data?: { privacy_level_options?: string[] };
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
        ? `Auth OK — Direct Post scope confirmed${j.data?.privacy_level_options?.length ? ` (${j.data.privacy_level_options.length} privacy options)` : ""}`
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
