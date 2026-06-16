import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "./config";

let cached: { key: string; client: Anthropic } | null = null;

/** Anthropic client built from the *current* API key (rebuilt when it changes). */
export function getClient(): Anthropic {
  const key = getSettings().anthropicApiKey;
  if (!cached || cached.key !== key) {
    cached = { key, client: new Anthropic({ apiKey: key || undefined }) };
  }
  return cached.client;
}
