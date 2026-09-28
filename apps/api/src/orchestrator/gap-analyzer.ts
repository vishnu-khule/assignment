import { Injectable } from "@nestjs/common";
import type { SessionContext } from "@proposal/schemas";
import { runGapAnalysisStep } from "@proposal/orchestrator";

@Injectable()
export class GapAnalyzer {
  analyze(
    context: SessionContext,
    userMessage: string,
    attachmentExcerpts: string[] = [],
    requirementsSeed?: Record<string, unknown>,
  ) {
    return runGapAnalysisStep(
      context,
      userMessage,
      attachmentExcerpts,
      requirementsSeed,
    );
  }
}
