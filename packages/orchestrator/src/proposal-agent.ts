import type {
  AgentRunStep,
  IntakeResult,
  ProposalSnapshot,
  ReferenceDocumentExtraction,
  SessionContext,
} from "@proposal/schemas";
import {
  applyIntakeToContext,
  buildBillOfQuantities,
  buildDocumentedAssumptions,
  buildProjectData,
  fastModel,
  primaryModel,
  runIntakeAssistant,
} from "@proposal/llm";
import { buildProposalSnapshot } from "./build-snapshot.js";
import { defaultReferenceRates } from "./default-reference-rates.js";
import { runGapAnalysisStep } from "./gap-step.js";

export type AgentStepRecord = {
  step: AgentRunStep;
  model?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency_ms: number;
};

export type AgentStepHandler = (record: AgentStepRecord) => Promise<void>;

export type ProposalChatTurnInput = {
  context: SessionContext;
  userMessage: string;
  attachmentRefs: { id?: string; filename: string; mime_type?: string }[];
  attachmentExcerpts: string[];
  referenceExtractions: ReferenceDocumentExtraction[];
  requirementsSeed: Record<string, unknown>;
  onStep?: AgentStepHandler;
  onStepStart?: (step: AgentRunStep) => Promise<void>;
  onAssistantDelta?: (delta: string) => void;
};

export type ProposalChatTurnResult = {
  intake: IntakeResult;
  contextAfterIntake: SessionContext;
  analysis: Awaited<ReturnType<typeof runGapAnalysisStep>>;
};

/** Single AI agent turn: intake → gap → clarification (one question). */
export async function runProposalChatTurn(
  input: ProposalChatTurnInput,
): Promise<ProposalChatTurnResult> {
  const contextForIntake = {
    ...input.context,
    requirements: {
      ...input.requirementsSeed,
      reference_extractions: input.referenceExtractions,
    },
  };

  await input.onStepStart?.("intake");
  const intakeStarted = Date.now();
  const intake = await runIntakeAssistant({
    user_message: input.userMessage,
    attachments: input.attachmentRefs,
    reference_extractions: input.referenceExtractions,
    default_currency: input.context.currency,
    default_language: input.context.locale,
  });
  const contextAfterIntake = applyIntakeToContext(contextForIntake, intake);
  await input.onStep?.({
    step: "intake",
    model: intake.confidence > 0.5 ? fastModel() : primaryModel(),
    input: {
      message: input.userMessage,
      attachments: input.attachmentRefs,
    },
    output: { intake },
    latency_ms: Date.now() - intakeStarted,
  });

  await input.onStepStart?.("gap");
  const gapStarted = Date.now();
  const analysis = await runGapAnalysisStep(
    contextAfterIntake,
    input.userMessage,
    input.attachmentExcerpts,
    input.requirementsSeed,
    { onAssistantDelta: input.onAssistantDelta },
  );
  await input.onStepStart?.("clarification");
  await input.onStep?.({
    step: "gap",
    model: fastModel(),
    input: { message: input.userMessage, context: contextAfterIntake },
    output: {
      gap_readiness: analysis.gap_readiness,
      full_gap: analysis.full_gap_readiness,
      questions: analysis.questions,
    },
    latency_ms: Date.now() - gapStarted,
  });

  await input.onStep?.({
    step: "clarification",
    model: fastModel(),
    input: { missing: analysis.gap_readiness.missing },
    output: {
      message: analysis.assistant_message,
      quick_replies: analysis.clarification.quick_replies,
    },
    latency_ms: 0,
  });

  return { intake, contextAfterIntake, analysis };
}

export type ProposalGenerateInput = {
  session_id: string;
  org_id: string;
  context: SessionContext;
  companyName: string;
  logoUrl?: string;
  ragSnippets: string[];
  onStep?: AgentStepHandler;
};

export type ProposalGenerateResult = {
  snapshot: ProposalSnapshot;
  boq: Awaited<ReturnType<typeof buildBillOfQuantities>>;
};

/** Generate path: project data → BOQ → 3-tier snapshot (writer + QA per tier). */
export async function runProposalGenerate(
  input: ProposalGenerateInput,
): Promise<ProposalGenerateResult> {
  const projectData = buildProjectData(input.context, input.ragSnippets);
  const boqStarted = Date.now();
  const referenceRates = defaultReferenceRates(input.context.currency);
  const boq = await buildBillOfQuantities(projectData, referenceRates);
  await input.onStep?.({
    step: "boq",
    model: primaryModel(),
    input: { project_data: projectData, reference_rates: referenceRates },
    output: { item_count: boq.items.length, flagged: boq.flagged_assumptions },
    latency_ms: Date.now() - boqStarted,
  });

  const snapStarted = Date.now();
  const snapshot = await buildProposalSnapshot(
    input.context,
    { company_name: input.companyName, logo_url: input.logoUrl },
    undefined,
    boq,
    referenceRates,
    input.ragSnippets,
  );
  await input.onStep?.({
    step: "proposal_writer",
    model: primaryModel(),
    input: { session_id: input.session_id, tiers: ["basic", "modern", "premium"] },
    output: {
      snapshot_id: snapshot.snapshot_id,
      content_hash: snapshot.content_hash,
    },
    latency_ms: Date.now() - snapStarted,
  });

  await input.onStep?.({
    step: "qa",
    model: fastModel(),
    input: { snapshot_id: snapshot.snapshot_id },
    output: { qa_verification: snapshot.qa_verification ?? null },
    latency_ms: 0,
  });

  return { snapshot, boq };
}

export { buildDocumentedAssumptions };
