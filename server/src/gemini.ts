import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { getSettings } from "./config";

let cached: { key: string; client: GoogleGenAI } | null = null;

/** Google Gen AI client built from the current Gemini API key. */
export function getGemini(): GoogleGenAI {
  const key = getSettings().geminiApiKey;
  if (!cached || cached.key !== key) {
    cached = { key, client: new GoogleGenAI({ apiKey: key }) };
  }
  return cached.client;
}

/** Resolve the model id, defaulting to a Gemini Flash model. */
export function geminiModel(): string {
  const m = getSettings().model;
  return m.startsWith("gemini") ? m : "gemini-2.5-flash";
}

/** generateContent with retry/backoff on transient overload / rate-limit. */
export async function generateWithRetry(
  params: GenerateContentParameters,
  onRetry?: (attempt: number, waitMs: number) => void,
): Promise<GenerateContentResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await getGemini().models.generateContent(params);
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      const transient = /(\b429\b|\b503\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|deadline)/i.test(msg);
      if (!transient || attempt === 3) throw e;
      const waitMs = 2000 * 2 ** attempt; // 2s, 4s, 8s
      onRetry?.(attempt + 1, waitMs);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

