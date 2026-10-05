import type { ProviderTestResult } from "@/lib/providers/registry";
import { getSecret } from "@/lib/secrets.core";

export async function testGeminiAuth(): Promise<ProviderTestResult> {
  const key = (await getSecret("GEMINI_CAPTION_API_KEY")) || (await getSecret("GEMINI_STRATEGY_API_KEY"));
  if (!key) return { providerId: "gemini", ok: false, status: 0, message: "Add a Gemini key in Settings." };
  const model = process.env.GEMINI_CAPTION_MODEL || "gemini-3.5-flash-lite";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Reply OK" }] }], generationConfig: { maxOutputTokens: 8 } }),
    });
    return { providerId: "gemini", ok: response.ok, status: response.status, message: response.ok ? "Gemini text API is reachable." : "Gemini rejected the key or model. Check your key and model name." };
  } catch {
    return { providerId: "gemini", ok: false, status: 0, message: "Could not reach Gemini. Check server network configuration." };
  }
}
