import { Injectable, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import {
  applyUserContentToRequirements,
  assumptionsSummaryMarkdown,
  buildDocumentedAssumptions,
  enrichRequirementsFromExtractions,
  inferSiteLocale,
  wantsGenerateWithAssumptions,
} from "@proposal/llm";
import { runProposalFlowAgent } from "@proposal/orchestrator";
import { DataAccessService } from "../data/data-access.service";
import { EventsGateway } from "../events/events.gateway";
import type { CreateSessionDto, PostMessageDto } from "./sessions.dto";

type MessageResult = {
  session: Awaited<ReturnType<DataAccessService["getSession"]>>;
  message: Awaited<ReturnType<DataAccessService["addMessage"]>>;
  questions: { field_id: string; question: string }[];
  quick_replies: { label: string; value: string; field?: string }[];
  intake: unknown;
  gap_readiness: unknown;
};

@Injectable()
export class SessionsService {
  constructor(
    private readonly data: DataAccessService,
    private readonly events: EventsGateway,
  ) {}

  async create(orgId: string, dto: CreateSessionDto) {
    const session = await this.data.createSession(orgId, dto.currency ?? "USD");
    if (dto.customer_name) {
      session.context.customer.name = dto.customer_name;
      await this.data.updateSession(session.id, { context: session.context });
    }
    return session;
  }

  async list(orgId: string) {
    return this.data.listSessions(orgId);
  }

  async listExtractions(orgId: string, id: string) {
    const session = await this.data.getSession(orgId, id);
    if (!session) throw new NotFoundException("Session not found");
    const extractions = await this.data.listDocumentExtractions(id);
    return { session_id: id, extractions };
  }

  async listAttachments(orgId: string, id: string) {
    const session = await this.data.getSession(orgId, id);
    if (!session) throw new NotFoundException("Session not found");
    const attachments = await this.data.listAttachments(id);
    return { session_id: id, attachments };
  }

  async listAgentRuns(orgId: string, id: string) {
    const session = await this.data.getSession(orgId, id);
    if (!session) throw new NotFoundException("Session not found");
    const runs = await this.data.listAgentRuns(id);
    return { session_id: id, runs };
  }

  async get(orgId: string, id: string) {
    const session = await this.data.getSession(orgId, id);
    if (!session) throw new NotFoundException("Session not found");
    return {
      ...session,
      messages: await this.data.listMessages(id),
    };
  }

  async postMessage(orgId: string, id: string, dto: PostMessageDto) {
    return this.processMessage(orgId, id, dto);
  }

  async postMessageStream(
    orgId: string,
    id: string,
    dto: PostMessageDto,
    res: Response,
  ) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const write = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'D',location:'sessions.service.ts:stream_start',message:'postMessageStream start',data:{sessionId:id,contentLen:dto.content?.length??0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const result = await this.processMessage(orgId, id, dto, {
        onAgentStep: (step, phase) => write("agent_step", { step, phase }),
        onTool: (tool, phase) => write("tool", { tool, phase }),
        onToken: (delta) => write("token", { delta }),
      });
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'E',location:'sessions.service.ts:stream_done',message:'processMessage ok',data:{assistantLen:result.message?.content?.length??0,status:result.session?.status},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      write("done", result);
      res.end();
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'D',location:'sessions.service.ts:stream_err',message:'processMessage failed',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      write("error", {
        message: err instanceof Error ? err.message : "Message failed",
      });
      res.end();
    }
  }

  private async processMessage(
    orgId: string,
    id: string,
    dto: PostMessageDto,
    stream?: {
      onAgentStep?: (step: string, phase: "start" | "complete") => void;
      onTool?: (tool: string, phase: "start" | "complete") => void;
      onToken?: (delta: string) => void;
    },
  ): Promise<MessageResult> {
    const session = await this.data.getSession(orgId, id);
    if (!session) throw new NotFoundException("Session not found");

    await this.data.addMessage(id, "user", dto.content);

    await this.data.updateSession(id, { status: "analysing" });
    this.events.emitSessionEvent({
      session_id: id,
      step: "analysing",
      message: "AI agent running",
    });

    const attachmentRefs = await this.data.listAttachmentRefs(id);
    const excerpts = await this.data.getChunkTexts(id);
    const referenceExtractions = await this.data.listDocumentExtractions(id);

    let requirementsSeed = enrichRequirementsFromExtractions(
      applyUserContentToRequirements(dto.content, session.context.requirements),
      referenceExtractions,
    );

    const siteText = [
      requirementsSeed.site_address,
      session.context.site?.address,
      session.context.requirements?.site_address,
    ]
      .filter((v) => typeof v === "string" && v.trim())
      .join(" ");
    const localeGuess = inferSiteLocale(siteText);
    let flowContext = session.context;
    if (localeGuess) {
      flowContext = {
        ...flowContext,
        currency: localeGuess.currency,
        locale: localeGuess.locale,
      };
      requirementsSeed = {
        ...requirementsSeed,
        pricing_currency: localeGuess.currency,
        pricing_region: localeGuess.country,
      };
    }

    const { intake, contextAfterIntake, analysis } = await runProposalFlowAgent({
      context: flowContext,
      userMessage: dto.content,
      attachmentRefs,
      attachmentExcerpts: excerpts,
      referenceExtractions,
      requirementsSeed,
      onAssistantDelta: stream?.onToken,
      onTool: async (event) => {
        stream?.onTool?.(event.tool, event.phase);
        this.events.emitSessionEvent({
          session_id: id,
          step: "analysing",
          message: `Tool: ${event.tool}`,
          payload: { agent_tool: event.tool, phase: event.phase },
        });
      },
      onStepStart: async (step) => {
        stream?.onAgentStep?.(step, "start");
        this.events.emitSessionEvent({
          session_id: id,
          step: "analysing",
          message: `Agent: ${step}`,
          payload: { agent_step: step, phase: "start" },
        });
      },
      onStep: async (record) => {
        await this.data.recordAgentRun({
          session_id: id,
          org_id: orgId,
          step: record.step,
          model: record.model,
          input: record.input,
          output: record.output,
          latency_ms: record.latency_ms,
        });
        stream?.onAgentStep?.(record.step, "complete");
        this.events.emitSessionEvent({
          session_id: id,
          step: "analysing",
          message: `Agent: ${record.step}`,
          payload: { agent_step: record.step, phase: "complete" },
        });
      },
    });

    let nextContext = { ...contextAfterIntake, ...analysis.context };
    let assistantText = analysis.assistant_message;
    let nextStatus = analysis.context.readiness?.can_generate
      ? "review"
      : "asking_questions";

    if (wantsGenerateWithAssumptions(dto.content)) {
      const assumptions = buildDocumentedAssumptions(
        analysis.gap_readiness.missing,
      );
      nextContext = {
        ...nextContext,
        requirements: {
          ...nextContext.requirements,
          generate_with_assumptions: true,
          documented_assumptions: assumptions,
        },
        readiness: {
          can_generate: true,
          blocking_missing: [],
        },
      };
      assistantText = assumptionsSummaryMarkdown(assumptions);
      nextStatus = "review";
    }

    nextContext = {
      ...nextContext,
      requirements: {
        ...nextContext.requirements,
        reference_extractions: referenceExtractions,
      },
      site:
        typeof requirementsSeed.site_address === "string"
          ? {
              ...nextContext.site,
              address: requirementsSeed.site_address,
            }
          : nextContext.site,
    };

    if (localeGuess) {
      nextContext = {
        ...nextContext,
        currency: localeGuess.currency,
        locale: localeGuess.locale,
      };
    }

    await this.data.updateSession(id, {
      status: nextStatus,
      context: nextContext,
    });

    const assistantMsg = await this.data.addMessage(id, "assistant", assistantText);

    this.events.emitSessionEvent({
      session_id: id,
      step: nextStatus,
      payload: {
        gaps: nextContext.gaps,
        readiness: nextContext.readiness,
      },
    });

    const updated = await this.data.getSession(orgId, id);
    return {
      session: updated,
      message: assistantMsg,
      questions: analysis.questions,
      quick_replies: analysis.clarification.quick_replies,
      intake,
      gap_readiness: analysis.gap_readiness,
    };
  }
}
