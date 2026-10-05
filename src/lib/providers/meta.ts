// providers/meta.ts — Instagram Reels publishing via the Meta Graph API.
import { requireSecret } from "@/lib/secrets.core";
import type { ProviderTestResult } from "@/lib/providers/registry";

// Keep this aligned with Meta's current Graph API version.
const GRAPH_BASE = "https://graph.facebook.com/v26.0";

export async function metaCredentials(): Promise<{ token: string; igId: string }> {
  return {
    token: await requireSecret("META_ACCESS_TOKEN"),
    igId: await requireSecret("INSTAGRAM_ACCOUNT_ID"),
  };
}

/** Action: publish a Reel and return the published Media ID. */
export async function postReels(videoUrl: string, caption: string): Promise<string> {
  const { token, igId } = await metaCredentials();
  const create = await fetch(`${GRAPH_BASE}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "REELS", video_url: videoUrl, caption, access_token: token }),
  });
  const created = await create.json();
  if (!create.ok || !created.id) throw new Error(`IG create: ${JSON.stringify(created)}`);
  // wait for processing
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(
      `${GRAPH_BASE}/${created.id}?fields=status_code&access_token=${encodeURIComponent(token)}`
    );
    const sj = await s.json();
    if (!s.ok) throw new Error(`IG status: ${JSON.stringify(sj)}`);
    if (sj.status_code === "FINISHED") {
      ready = true;
      break;
    }
    if (sj.status_code === "ERROR" || sj.status_code === "EXPIRED") {
      throw new Error(`IG processing failed: ${sj.status_code}`);
    }
  }
  if (!ready) throw new Error("Instagram Reel processing timed out; publishing was not attempted");
  const pub = await fetch(`${GRAPH_BASE}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: created.id, access_token: token }),
  });
  const pubJson = await pub.json();
  if (!pub.ok || !pubJson.id) throw new Error(`IG publish: ${JSON.stringify(pubJson)}`);
  return pubJson.id as string;
}

/** testAuth() — read the connected IG account back from the Graph API. */
export async function testMetaAuth(): Promise<ProviderTestResult> {
  const providerId = "meta";
  let token: string;
  let igId: string;
  try {
    ({ token, igId } = await metaCredentials());
  } catch (e) {
    return { providerId, ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${igId}?fields=username,account_type&access_token=${encodeURIComponent(token)}`
    );
    const text = await res.text();
    let j: { username?: string; account_type?: string; error?: { message?: string } };
    try {
      j = JSON.parse(text);
    } catch {
      j = {};
    }
    if (res.ok && !j.error) {
      return {
        providerId,
        ok: true,
        status: res.status,
        message: `Auth OK — @${j.username ?? igId}${j.account_type ? ` (${j.account_type})` : ""}`,
        detail: `IG account ${igId}`,
      };
    }
    return {
      providerId,
      ok: false,
      status: res.status,
      message: j.error?.message ?? text.slice(0, 300),
      detail: `IG account ${igId}`,
    };
  } catch (e) {
    return { providerId, ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}
