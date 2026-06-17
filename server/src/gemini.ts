import { GoogleGenAI } from "@google/genai";
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
