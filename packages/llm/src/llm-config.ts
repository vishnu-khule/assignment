import {
  fastModel,
  getLlmClient,
  llmProvider,
  primaryModel,
} from "./client.js";

export function isLlmConfigured(): boolean {
  return getLlmClient() !== null;
}

export function llmStatus() {
  const provider = llmProvider();
  return {
    configured: isLlmConfigured(),
    provider: provider ?? "none",
    primary_model: primaryModel(),
    fast_model: fastModel(),
  };
}
