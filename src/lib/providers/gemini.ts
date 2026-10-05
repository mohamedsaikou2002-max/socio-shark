import { requireSecret } from "@/lib/secrets.core";

export type GeminiTask = "caption" | "strategy";

export async function generateGeminiText(task: GeminiTask, prompt: string): Promise<string> {
  const key = await requireSecret(task === "caption" ? "GEMINI_CAPTION_API_KEY" : "GEMINI_STRATEGY_API_KEY");
  const model = process.env[task === "caption" ? "GEMINI_CAPTION_MODEL" : "GEMINI_STRATEGY_MODEL"] || "gemini-3.5-flash-lite";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: task === "caption" ? 400 : 1400 },
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Gemini request failed (${response.status}): ${body.error?.message ?? "check the API key and model"}`);
  }
  const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text. Try again.");
  return text;
}
