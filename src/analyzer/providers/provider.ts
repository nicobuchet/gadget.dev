import type { AIProvider, GadgetConfig } from "../../types/index.js";
import { ClaudeProvider } from "./claude.js";

/**
 * Creates an AI provider based on config. Returns null if no provider
 * is configured or the required API key is missing.
 */
export function createProvider(config: GadgetConfig): AIProvider | null {
  const { provider, apiKey, model, generateModel, auditModel, maxTokens } = config.ai;

  switch (provider) {
    case "claude": {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) return null;
      return new ClaudeProvider(key, {
        model,
        generateModel,
        auditModel,
        maxTokens,
      });
    }
    case "openai": {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) return null;
      console.warn("OpenAI provider is not yet implemented, skipping AI");
      return null;
    }
    case "none":
      return null;
    default:
      console.warn(`Unknown AI provider: ${provider}, skipping AI`);
      return null;
  }
}
