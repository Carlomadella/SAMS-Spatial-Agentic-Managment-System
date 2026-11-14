import { getSettings } from "./config";
import { geminiModel } from "./gemini";
import { groqModel } from "./groq";
import { openaiModel } from "./openai";
import { openrouterModel } from "./openrouter";

/**
 * Il modello che il runtime usa **davvero** con il provider attivo.
 *
 * `settings.model` da solo non basta: ogni provider lo accetta solo se ha la sua forma
 * (es. OpenRouter vuole "vendor/modello") e altrimenti ripiega sul proprio default.
 * Con Claude il valore va così com'è all'agente gestito. La UI lo mostra al posto
 * dell'etichetta fissa degli agenti di partenza ("Claude Opus"), che è solo cosmetica.
 */
export function activeModel(): string {
  switch (getSettings().provider) {
    case "gemini":
      return geminiModel();
    case "groq":
      return groqModel();
    case "openai":
      return openaiModel();
    case "openrouter":
      return openrouterModel();
    default:
      return getSettings().model;
  }
}
