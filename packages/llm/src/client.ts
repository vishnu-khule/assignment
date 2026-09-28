import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

export type LlmProvider = "openai" | "gemini";

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

export function resolveLlmProvider(): LlmProvider | null {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "gemini" || explicit === "openai") {
    return explicit;
  }
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export function llmProvider(): LlmProvider | null {
  return resolveLlmProvider();
}

/** Chat client (OpenAI SDK) — OpenAI or Gemini via OpenAI-compatible endpoint. */
export function getLlmClient(): OpenAI | null {
  const provider = resolveLlmProvider();
  if (!provider) return null;

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return null;
    return new OpenAI({
      apiKey: key,
      baseURL: process.env.GEMINI_BASE_URL?.trim() || GEMINI_OPENAI_BASE,
    });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

/** @deprecated Use getLlmClient */
export function getOpenAI(): OpenAI | null {
  return getLlmClient();
}

/** Primary model — intake with docs, BOQ, proposals, document vision. */
export function primaryModel(): string {
  if (resolveLlmProvider() === "gemini") {
    return process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  }
  return process.env.OPENAI_MODEL ?? "gpt-4o";
}

/** Fast model — gap, clarification, light verification. */
export function fastModel(): string {
  if (resolveLlmProvider() === "gemini") {
    return process.env.GEMINI_FAST_MODEL ?? "gemini-3.5-flash-lite";
  }
  return process.env.OPENAI_FAST_MODEL ?? "gpt-4o-mini";
}

/** @deprecated Use primaryModel */
export const sonnetModel = primaryModel;

/** @deprecated Use fastModel */
export const haikuModel = fastModel;

/** @deprecated Use getLlmClient */
export function getAnthropic(): OpenAI | null {
  return getLlmClient();
}

export async function completeChat(params: {
  system: string;
  user: string | ChatCompletionContentPart[];
  model: string;
  max_tokens: number;
}): Promise<string> {
  const client = getLlmClient();
  if (!client) return "";

  try {
    const response = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.max_tokens,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',runId:'post-fix',hypothesisId:'D',location:'client.ts:completeChat',message:'LLM error, heuristic fallback',data:{provider:resolveLlmProvider(),error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return "";
  }
}

export async function streamChat(params: {
  system: string;
  user: string;
  model: string;
  max_tokens: number;
  onDelta: (text: string) => void;
}): Promise<string> {
  const client = getLlmClient();
  if (!client) {
    params.onDelta("");
    return "";
  }

  try {
    const stream = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.max_tokens,
      stream: true,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        params.onDelta(delta);
      }
    }
    return full;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',runId:'post-fix',hypothesisId:'D',location:'client.ts:streamChat',message:'LLM stream error, heuristic fallback',data:{provider:resolveLlmProvider(),error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return "";
  }
}
