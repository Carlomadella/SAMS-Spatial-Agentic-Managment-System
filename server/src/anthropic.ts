import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

/** Shared Anthropic SDK client. */
export const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey || undefined,
});
