import type { ProposalChatTurnInput, ProposalChatTurnResult } from "./proposal-agent.js";
import { runProposalChatTurn } from "./proposal-agent.js";

export type FlowToolEvent = {
  tool: string;
  phase: "start" | "complete";
  output?: Record<string, unknown>;
};

const STEP_TO_TOOL: Record<string, string> = {
  intake: "run_intake",
  gap: "analyze_gaps",
  clarification: "ask_user",
};

/** Tool-style agent wrapper around the real intake → gap → clarify pipeline. */
export async function runProposalFlowAgent(
  input: ProposalChatTurnInput & {
    onTool?: (event: FlowToolEvent) => Promise<void>;
    onAssistantDelta?: (delta: string) => void;
  },
): Promise<ProposalChatTurnResult> {
  const started = new Set<string>();

  return runProposalChatTurn({
    ...input,
    onAssistantDelta: input.onAssistantDelta,
    onStepStart: async (step) => {
      const tool = STEP_TO_TOOL[step] ?? step;
      if (!started.has(tool)) {
        started.add(tool);
        await input.onTool?.({ tool, phase: "start" });
      }
    },
    onStep: async (record) => {
      const tool = STEP_TO_TOOL[record.step] ?? record.step;
      await input.onTool?.({
        tool,
        phase: "complete",
        output: record.output,
      });
      await input.onStep?.(record);
    },
  });
}
