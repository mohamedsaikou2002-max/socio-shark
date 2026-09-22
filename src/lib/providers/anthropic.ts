// providers/anthropic.ts — Claude caption / prompt generation.
import { requireSecret } from "@/lib/secrets.core";
import type { ProviderTestResult } from "@/lib/providers/registry";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_MODEL = "claude-sonnet-4-5";

async function anthropicKey(): Promise<string> {
  return await requireSecret("ANTHROPIC_API_KEY");
}

/** Action: single-turn text completion. */
export async function llm(prompt: string, max = 350): Promise<string> {
  const key = await anthropicKey();
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

/** Action: image → short marketing caption (used by the content pipeline). */
export async function generateImageCaption(
  imageBase64: string,
  hashtags: string
): Promise<string> {
  const key = await anthropicKey();
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
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
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

/** testAuth() — verify the key against the models endpoint. */
export async function testAnthropicAuth(): Promise<ProviderTestResult> {
  const providerId = "anthropic";
  let key: string;
  try {
    key = await anthropicKey();
  } catch (e) {
    return { providerId, ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
  const detail = `key ${key.slice(0, 6)}… (len ${key.length})`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    const text = await res.text();
    if (res.ok) {
      return { providerId, ok: true, status: res.status, message: "Auth OK — Anthropic accepted the key", detail };
    }
    let j: { error?: { message?: string } };
    try {
      j = JSON.parse(text);
    } catch {
      j = {};
    }
    return {
      providerId,
      ok: false,
      status: res.status,
      message: j.error?.message ?? text.slice(0, 300),
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
