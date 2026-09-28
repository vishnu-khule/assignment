import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import type { AgentRun, AgentRunStep } from "@proposal/schemas";

const KEY = (sessionId: string) => `agent_runs:session:${sessionId}`;

export type AgentRunInput = {
  session_id: string;
  org_id: string;
  step: AgentRunStep;
  model?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency_ms: number;
};

export async function pushAgentRunRedis(
  redisUrl: string,
  run: AgentRun,
): Promise<void> {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  try {
    const raw = await redis.get(KEY(run.session_id));
    const list = raw ? (JSON.parse(raw) as AgentRun[]) : [];
    list.push(run);
    await redis.set(KEY(run.session_id), JSON.stringify(list), "EX", 604800);
  } finally {
    await redis.quit();
  }
}

export async function appendAgentRunRedis(
  redisUrl: string,
  input: AgentRunInput,
): Promise<AgentRun> {
  const run: AgentRun = {
    run_id: randomUUID(),
    session_id: input.session_id,
    org_id: input.org_id,
    step: input.step,
    model: input.model,
    input: input.input,
    output: input.output,
    latency_ms: input.latency_ms,
    created_at: new Date().toISOString(),
  };
  await pushAgentRunRedis(redisUrl, run);
  return run;
}

export async function listAgentRunsRedis(
  redisUrl: string,
  sessionId: string,
): Promise<AgentRun[]> {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  try {
    const raw = await redis.get(KEY(sessionId));
    return raw ? (JSON.parse(raw) as AgentRun[]) : [];
  } finally {
    await redis.quit();
  }
}
