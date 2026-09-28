import type { TradeChecklistField } from "./gap-readiness.js";

export type TradeKey = "plumbing" | "electrical" | "hvac" | "general";

const BASE: TradeChecklistField[] = [
  {
    field: "work_summary",
    required: true,
    why_needed: "Defines scope and line items for labour and materials.",
    question: "What work should this quote cover?",
    priority: 1,
  },
  {
    field: "site_address",
    required: true,
    why_needed: "Location affects travel, permits, and tax.",
    question: "What is the job site address?",
    priority: 2,
  },
  {
    field: "area_sqm",
    required: true,
    why_needed: "Area drives material quantities and labour hours.",
    question: "What is the approximate area (sq m or sq ft)?",
    priority: 1,
  },
  {
    field: "material_grade",
    required: true,
    why_needed: "Grade sets unit costs for Basic vs Premium tiers.",
    question: "Which material level: economy, standard, or premium?",
    priority: 2,
  },
  {
    field: "site_access",
    required: true,
    why_needed: "Access constraints add labour and equipment cost.",
    question: "Any site access limits (stairs, parking, hours, permits)?",
    priority: 3,
  },
  {
    field: "deadline",
    required: true,
    why_needed: "Rush timelines change labour rates and scheduling.",
    question: "When does the customer need this done?",
    priority: 3,
  },
  {
    field: "budget_range",
    required: false,
    why_needed: "Helps right-size tier options without guessing.",
    question: "Does the customer have a rough budget range?",
    priority: 4,
  },
];

const BY_TRADE: Record<TradeKey, TradeChecklistField[]> = {
  plumbing: [
    {
      field: "water_shutoff",
      required: false,
      why_needed: "Shutoff access affects time on site.",
      question: "Is the main water shutoff easy to reach?",
      priority: 4,
    },
  ],
  electrical: [
    {
      field: "panel_capacity",
      required: true,
      why_needed: "Panel size drives material and labour for upgrades.",
      question: "What is the main panel size (e.g. 100A, 200A)?",
      priority: 1,
    },
  ],
  hvac: [
    {
      field: "system_type",
      required: true,
      why_needed: "Repair vs replace changes price by an order of magnitude.",
      question: "Is this a repair or a full system replacement?",
      priority: 1,
    },
  ],
  general: [],
};

export function getTradeChecklist(trade: TradeKey): TradeChecklistField[] {
  return [...BASE, ...BY_TRADE[trade]];
}
