// Server-only activation helpers.
// Replaces the delta's Cloudflare-KV design with the project's existing
// Lovable Cloud database, and its Worker `env` secrets with getSecret()
// (env var first, app_secrets table as fallback).

import { getSecret } from "./secrets.functions";

export type ActivationError =
  | "invalid_json"
  | "missing_fields"
  | "code_already_used"
  | "session_not_paid"
  | "invalid_code"
  | "not_configured";

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives a 6-digit code deterministically FROM a real Stripe Checkout
 * Session ID using a server-only secret. Never valid unless it matches a
 * session Stripe confirms was paid.
 */
export async function deriveActivationCode(sessionId: string, secret: string): Promise<string> {
  const digest = await hmacSha256Hex(secret, sessionId);
  const num = parseInt(digest.slice(0, 8), 16) % 1_000_000;
  return num.toString().padStart(6, "0");
}

export async function getActivationSecrets() {
  const [stripeKey, hmacSecret] = await Promise.all([
    getSecret("STRIPE_SECRET_KEY"),
    getSecret("ACTIVATION_HMAC_SECRET"),
  ]);
  return { stripeKey, hmacSecret };
}

export async function verifyStripeSession(sessionId: string, stripeSecretKey: string) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; payment_status?: string };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
