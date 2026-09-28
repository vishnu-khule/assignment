import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { isDbConfigured, getExportArtifact } from "@proposal/db";
import { formatPriceSummary } from "@proposal/llm";
import { recomputeTierPricingFromLineItems } from "@proposal/pricing-engine";
import { publicUrl } from "@proposal/storage";
import { DataAccessService } from "../data/data-access.service";
import { QueueService } from "../queue/queue.service";
import { EventsGateway } from "../events/events.gateway";
import { enrichRequirementsFromExtractions, isLlmConfigured } from "@proposal/llm";
import type { TierKey } from "@proposal/schemas";
import type { PatchTierLineItemsDto } from "./proposals.dto";

@Injectable()
export class ProposalsService {
  constructor(
    private readonly data: DataAccessService,
    private readonly queues: QueueService,
    private readonly events: EventsGateway,
  ) {}

  async enqueueGenerate(orgId: string, sessionId: string) {
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'GEN',location:'proposals.service.ts:enqueue',message:'generate requested',data:{sessionId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!isLlmConfigured()) {
      throw new BadRequestException({
        message:
          "AI proposal generation requires GEMINI_API_KEY or OPENAI_API_KEY in .env. Restart API + worker.",
      });
    }
    const session = await this.data.getSession(orgId, sessionId);
    if (!session) throw new NotFoundException("Session not found");
    const withAssumptions =
      session.context.requirements?.generate_with_assumptions === true;
    if (!session.context.readiness?.can_generate && !withAssumptions) {
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'GEN',location:'proposals.service.ts:blocked',message:'not ready',data:{blocking:session.context.readiness?.blocking_missing??[]},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw new BadRequestException({
        message: "Missing required information",
        blocking: session.context.readiness?.blocking_missing ?? [],
        hint: 'Answer the questions or send "generate with assumptions".',
      });
    }

    await this.data.updateSession(sessionId, { status: "generating" });

    const extractions = await this.data.listDocumentExtractions(sessionId);
    const reqPatch = enrichRequirementsFromExtractions(
      session.context.requirements as Record<string, unknown>,
      extractions,
    );
    const siteAddress =
      session.context.site?.address ??
      (typeof reqPatch.site_address === "string" ? reqPatch.site_address : undefined);
    const generateContext = {
      ...session.context,
      site: siteAddress
        ? { ...session.context.site, address: siteAddress }
        : session.context.site,
      requirements: {
        ...session.context.requirements,
        ...reqPatch,
        reference_extractions: extractions,
      },
    };

    const job = await this.queues.generateQueue.add("generate", {
      session_id: sessionId,
      org_id: orgId,
      context: generateContext,
    });

    this.events.emitSessionEvent({
      session_id: sessionId,
      step: "generating",
      message: "Building three proposal tiers",
    });

    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'GEN',location:'proposals.service.ts:queued',message:'job queued',data:{jobId:job.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { job_id: job.id, status: "queued" };
  }

  async getOptions(orgId: string, sessionId: string) {
    const session = await this.data.getSession(orgId, sessionId);
    if (!session) throw new NotFoundException("Session not found");

    const snapshot = await this.data.getSnapshotBySession(sessionId);
    // #region agent log
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'SNAP',location:'proposals.service.ts:getOptions',message:'options fetch',data:{sessionId,hasSnapshot:!!snapshot,sessionStatus:session.status},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!snapshot) {
      return { session_id: sessionId, status: session.status, options: null };
    }

    let status = session.status;
    if (status === "generating") {
      await this.data.updateSession(sessionId, { status: "review" });
      status = "review";
    }

    return {
      session_id: sessionId,
      status,
      snapshot_id: snapshot.snapshot_id,
      content_hash: snapshot.content_hash,
      currency: snapshot.currency,
      branding: snapshot.branding,
      assumptions: snapshot.assumptions,
      documented_assumptions: snapshot.documented_assumptions ?? null,
      bill_of_quantities: snapshot.bill_of_quantities ?? null,
      options: {
        basic: snapshot.tiers.basic,
        modern: snapshot.tiers.modern,
        premium: snapshot.tiers.premium,
      },
    };
  }

  async getExportUrl(
    orgId: string,
    sessionId: string,
    tier: string,
    format: string,
  ) {
    const validTiers: TierKey[] = ["basic", "modern", "premium"];
    if (!validTiers.includes(tier as TierKey)) {
      throw new BadRequestException("Invalid tier");
    }
    const validFormats = ["pdf", "pdf-proposal", "pdf-estimate", "docx", "xlsx"];
    if (!validFormats.includes(format)) {
      throw new BadRequestException("Invalid format");
    }

    const snapshot = await this.data.getSnapshotBySession(sessionId);
    if (!snapshot || snapshot.org_id !== orgId) {
      throw new NotFoundException("Snapshot not found");
    }

    if (isDbConfigured()) {
      const artifact = await getExportArtifact(
        snapshot.snapshot_id,
        tier,
        format,
      );
      if (artifact) {
        return {
          url: publicUrl(artifact.storageKey),
          tier,
          format,
          snapshot_id: snapshot.snapshot_id,
        };
      }
    }

    const fileName =
      format === "pdf-proposal"
        ? `${tier}.proposal.pdf`
        : format === "pdf-estimate"
          ? `${tier}.estimate.pdf`
          : `${tier}.${format}`;
    const key = `${orgId}/exports/${snapshot.snapshot_id}/${fileName}`;
    return {
      url: publicUrl(key),
      tier,
      format,
      snapshot_id: snapshot.snapshot_id,
    };
  }

  async patchTierLineItems(
    orgId: string,
    sessionId: string,
    dto: PatchTierLineItemsDto,
  ) {
    const snapshot = await this.data.getSnapshotBySession(sessionId);
    if (!snapshot || snapshot.org_id !== orgId) {
      throw new NotFoundException("Snapshot not found");
    }

    const tier = dto.tier;
    const bundle = snapshot.tiers[tier];
    const pricing = recomputeTierPricingFromLineItems(
      bundle.pricing,
      dto.line_items,
    );
    const price_summary = formatPriceSummary(pricing, snapshot.currency);
    const document_sections = bundle.document_sections
      ? { ...bundle.document_sections, price_summary }
      : undefined;

    const next = {
      ...snapshot,
      version: snapshot.version + 1,
      tiers: {
        ...snapshot.tiers,
        [tier]: {
          ...bundle,
          pricing,
          document_sections,
        },
      },
    };
    next.content_hash = createHash("sha256")
      .update(JSON.stringify(next))
      .digest("hex");

    await this.data.updateSnapshot(next);

    await this.data.recordAgentRun({
      session_id: sessionId,
      org_id: orgId,
      step: "export",
      input: { tier, line_items: dto.line_items },
      output: { pricing, content_hash: next.content_hash },
      latency_ms: 0,
    });

    await this.queues.exportQueue.add("export", {
      snapshot_id: next.snapshot_id,
      org_id: orgId,
      formats: ["pdf", "xlsx", "docx"],
    });

    return {
      snapshot_id: next.snapshot_id,
      tier,
      pricing,
      options: {
        basic: next.tiers.basic,
        modern: next.tiers.modern,
        premium: next.tiers.premium,
      },
    };
  }
}
