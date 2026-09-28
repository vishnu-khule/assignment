import {
  writeProposalDocument,
  verifyTierProposal,
  formatPriceSummary,
  type WriteProposalInput,
} from "@proposal/llm";
import type {
  NarrativeSections,
  ProposalDocumentSections,
} from "@proposal/schemas";

const MAX_STEP6_RETRIES = 2;

export async function buildTierWithQa(
  baseInput: WriteProposalInput,
): Promise<{
  document: ProposalDocumentSections;
  narrative: NarrativeSections;
  qa_attempts: number;
}> {
  let qa_fixes: string[] = [];
  let lastDocument!: ProposalDocumentSections;
  let lastNarrative!: NarrativeSections;

  for (let attempt = 0; attempt <= MAX_STEP6_RETRIES; attempt++) {
    const { document, narrative } = await writeProposalDocument({
      ...baseInput,
      qa_fixes,
    });
    lastDocument = document;
    lastNarrative = narrative;

    const qa = verifyTierProposal({
      tier: baseInput.tier,
      document,
      pricing: baseInput.priced_items,
      currency: baseInput.currency,
      source_assumptions: baseInput.assumptions,
      expected_price_summary: formatPriceSummary(
        baseInput.priced_items,
        baseInput.currency,
      ),
    });

    if (qa.passed) {
      return { document, narrative, qa_attempts: attempt + 1 };
    }

    if (attempt >= MAX_STEP6_RETRIES) {
      return { document, narrative, qa_attempts: attempt + 1 };
    }

    qa_fixes = qa.issues.map(
      (i) => `[${i.severity}] ${i.location}: ${i.fix}`,
    );
  }

  return {
    document: lastDocument,
    narrative: lastNarrative,
    qa_attempts: MAX_STEP6_RETRIES + 1,
  };
}
