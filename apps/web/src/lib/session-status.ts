import type { UiStatus } from "../store/session-ui";

/** Map API session status → UI state machine. */
export function mapBackendStatus(apiStatus: string): UiStatus {
  switch (apiStatus) {
    case "uploading":
      return "uploading";
    case "analysing":
      return "analysing";
    case "asking_questions":
      return "clarifying";
    case "generating":
      return "generating";
    case "review":
      return "review";
    case "shared":
      return "shared";
    default:
      return "idle";
  }
}

export const STATUS_LABELS: Record<UiStatus, string> = {
  idle: "Ready",
  uploading: "Uploading",
  analysing: "Analysing",
  clarifying: "Clarifying",
  generating: "Generating",
  review: "Review",
  shared: "Shared",
};
