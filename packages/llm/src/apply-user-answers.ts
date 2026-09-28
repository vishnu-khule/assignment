import { parseDimensionsFromMessage } from "./parse-message-fields.js";

const GENERATE_WITH_ASSUMPTIONS =
  /\bgenerate\s+with\s+assumptions\b/i;

export function wantsGenerateWithAssumptions(message: string): boolean {
  return GENERATE_WITH_ASSUMPTIONS.test(message);
}

/** Parse `field: value` lines and short replies into requirements. */
export function applyUserContentToRequirements(
  message: string,
  requirements: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...requirements,
    last_user_message: message,
  };

  for (const line of message.split(/\n+/)) {
    const m = line.match(/^([a-z_]+)\s*:\s*(.+)$/i);
    if (m) {
      next[m[1].toLowerCase()] = m[2].trim();
    }
  }

  const lower = message.toLowerCase();
  if (/\b100a\b/.test(lower)) next.panel_capacity = "100A";
  if (/\b200a\b/.test(lower)) next.panel_capacity = "200A";
  if (/\brepair\b/.test(lower) && !next.system_type) next.system_type = "repair";
  if (/\breplacement\b/.test(lower)) next.system_type = "full replacement";
  if (/\beconomy\b|\bbasic\b/.test(lower)) next.material_grade = "economy";
  if (/\bstandard\b|\bmodern\b|\bnormal\b/.test(lower)) next.material_grade = "standard";
  if (/\bpremium\b/.test(lower)) next.material_grade = "premium";
  if (message.trim().length > 8 && !next.work_summary) {
    next.work_summary = message.trim();
  }

  if (typeof next.area_dimensions === "string") {
    const fromLabel = parseDimensionsFromMessage(next.area_dimensions);
    if (fromLabel) {
      next.area_sqm = fromLabel.area_sqm;
      next.area_sqft = fromLabel.area_sqft;
    }
  }

  const area = parseDimensionsFromMessage(message);
  if (area) {
    next.area_sqm = area.area_sqm;
    next.area_sqft = area.area_sqft;
    next.area_dimensions = area.area_dimensions;
  }

  if (/\bkitchen\b/i.test(message)) next.space_type = "kitchen";
  if (/\brenov|remodel|revamp|revnuve\b/i.test(message)) {
    next.job_type = next.job_type ?? "renovation";
  }

  const siteFromLabel = message.match(/\b(?:site[_\s]?address|address)\s*(?:is|:)\s*(.+)/i);
  if (siteFromLabel?.[1]?.trim()) {
    next.site_address = siteFromLabel[1].trim();
  } else if (
    !parseDimensionsFromMessage(message) &&
    !next.site_address &&
    !/^(no|none|standard|economy|premium|stairs)$/i.test(message.trim()) &&
    (/\b\d{6}\b/.test(message) ||
      /\b(mumbai|delhi|bengaluru|bangalore|chennai|kolkata|pune|hyderabad|noida|gurgaon|gurugram|malad|bandra|andheri|thane|chincholi|london|birmingham|manchester|leeds|glasgow)\b/i.test(
        message,
      )) &&
    message.trim().length >= 5 &&
    message.trim().length <= 280
  ) {
    next.site_address = message.trim();
  }

  if (/\bstairs\b/i.test(message)) {
    next.site_access = next.site_access ?? "stairs — limited access";
  } else if (/^(no|none|n\/a)$/i.test(message.trim())) {
    next.site_access = next.site_access ?? "no special limits";
  } else if (/\b(asap|rush)\b/i.test(message)) {
    next.deadline = "ASAP";
  } else if (/\bflex/i.test(message)) {
    next.deadline = "flexible";
  }

  const gap = requirements.gap_readiness as
    | { missing?: { field: string }[] }
    | undefined;
  const activeField = gap?.missing?.[0]?.field;
  const reply = message.trim();
  if (
    activeField &&
    reply &&
    reply.length <= 200 &&
    (next[activeField] == null || next[activeField] === "")
  ) {
    next[activeField] = reply;
  }

  // #region agent log
  if (next.site_access || activeField === "site_access") {
    fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',runId:'access-fix',hypothesisId:'ACCESS',location:'apply-user-answers.ts',message:'site_access capture',data:{activeField,site_access:next.site_access},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

  return next;
}

/** Same as applyUserContentToRequirements (alias for intake pipeline). */
export function enrichRequirementsFromMessage(
  message: string,
  requirements: Record<string, unknown>,
): Record<string, unknown> {
  return applyUserContentToRequirements(message, requirements);
}
