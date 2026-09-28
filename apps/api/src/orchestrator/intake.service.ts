import { Injectable } from "@nestjs/common";
import type { IntakeResult, ReferenceDocumentExtraction, SessionContext } from "@proposal/schemas";
import { applyIntakeToContext, runIntakeAssistant } from "@proposal/llm";

@Injectable()
export class IntakeService {
  async run(
    context: SessionContext,
    userMessage: string,
    attachments: { id?: string; filename: string; mime_type?: string }[],
    referenceExtractions: ReferenceDocumentExtraction[] = [],
  ): Promise<{ intake: IntakeResult; context: SessionContext }> {
    const intake = await runIntakeAssistant({
      user_message: userMessage,
      attachments,
      reference_extractions: referenceExtractions,
      default_currency: context.currency,
      default_language: context.locale,
    });
    const nextContext = applyIntakeToContext(context, intake);
    return { intake, context: nextContext };
  }
}
